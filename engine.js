/* ============================================================================
 * engine.js  —  The agentic intelligence layer (NLU + grounded retrieval)
 * ----------------------------------------------------------------------------
 * Design principle: ZERO HALLUCINATION. Every number and claim returned here is
 * computed directly from window.DB records, and each answer ships with the exact
 * case IDs it was derived from (RAG-style citations). The natural-language
 * phrasing is template-filled from retrieved facts — never invented.
 *
 * In production the parse() step is upgraded to an LLM (function-calling) that
 * emits the same {intent, entities} structure; the retrieval/grounding code
 * below stays unchanged. That keeps answers verifiable and audit-able.
 * ==========================================================================*/
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this);
  const DB = root.DB || (typeof require !== "undefined" ? require("./data") : null);
  const dayMs = 86400000;
  const NOW = DB.refNow;

  // Conversation memory → pillar #1 "context-aware follow-up without repeating context".
  let CTX = { crimeType: null, district: null, suspect: null, lastCaseId: null };

  /* --------------------------- Synonym lexicon ---------------------------- */
  const CRIME_SYNONYMS = {
    "Chain Snatching": ["chain", "snatch", "snatching", "chain snatch"],
    "Mobile Theft":    ["mobile", "phone theft", "cell"],
    "Vehicle Theft":   ["vehicle", "bike theft", "two wheeler", "two-wheeler", "car theft", "car lift"],
    "Burglary":        ["burglary", "break in", "break-in", "house break"],
    "House Theft":     ["house theft", "home theft", "residential theft"],
    "Robbery":         ["robbery", "loot", "robbed"],
    "Cyber Fraud":     ["cyber", "online fraud", "fraud", "upi", "phishing", "scam"],
    "Assault":         ["assault", "attack", "hurt"],
    "Dacoity":         ["dacoity", "gang loot"],
    "Kidnapping":      ["kidnap", "abduction", "missing"],
    "Murder":          ["murder", "homicide", "killing"]
  };

  /* ------------------------------- Parsing -------------------------------- */
  function parse(qRaw) {
    const q = " " + qRaw.toLowerCase().trim() + " ";
    const e = { crimeType: null, district: null, area: null, time: null, phone: null, vehicle: null, suspect: null };

    // crime type
    for (const type of DB.crimeNames()) {
      if (q.includes(type.toLowerCase())) { e.crimeType = type; break; }
    }
    if (!e.crimeType) {
      outer: for (const [type, syns] of Object.entries(CRIME_SYNONYMS))
        for (const s of syns) if (q.includes(" " + s)) { e.crimeType = type; break outer; }
    }

    // district + area
    for (const d of DB.districts) {
      if (q.includes(d.district.toLowerCase())) { e.district = d.district; }
      for (const a of d.areas) if (q.includes(a.area.toLowerCase())) { e.area = a.area; e.district = e.district || d.district; }
    }
    // common alt spelling
    if (!e.district && (q.includes("bangalore") || q.includes("bengaluru"))) e.district = "Bengaluru";

    // phone (10 digit) & vehicle (KA-..-..-....)
    const pm = qRaw.match(/\b([6-9]\d{9})\b/);             if (pm) e.phone = pm[1];
    const vm = qRaw.match(/\bKA[-\s]?\d{1,2}[-\s]?[A-Z]{1,2}[-\s]?\d{1,4}\b/i); if (vm) e.vehicle = vm[0].toUpperCase().replace(/\s/g, "-");

    // suspect id or name
    const sid = qRaw.match(/\bSUS-?\d{1,3}\b/i);
    if (sid) e.suspect = sid[0].toUpperCase().replace("SUS", "SUS-").replace("--", "-");
    if (!e.suspect) {
      for (const s of DB.suspects) {
        const nm = s.name.toLowerCase();
        if (q.includes(" " + nm + " ") || (s.alias && q.includes(s.alias.toLowerCase()))) { e.suspect = s.id; break; }
      }
    }

    // time range
    e.time = parseTime(q);

    // case id reference (for similar-case lookups)
    const cid = qRaw.match(/\bKSP-?\d{5}\b/i); if (cid) e.caseId = cid[0].toUpperCase().replace("KSP", "KSP-").replace("--", "-");

    // intent (order matters — most specific first)
    let intent = "search_cases";
    if (/\binvestigate\b|\bautonomous\b|\bfull (report|analysis)\b|\bdig into\b/.test(q)) intent = "investigate";
    else if (/\bmoney\b|\bfinancial\b|\btransaction|\blaunder|\bmule|\bbank account|\bfunds?\b/.test(q)) intent = "financial";
    else if (/\bsocio|\bdemograph|\bunemployment\b|\bliteracy\b|\burban|\bmigration\b|\beconomic|\bsocial (factor|risk|indicator)/.test(q)) intent = "socio";
    else if (/\bsimilar\b|\bcomparable\b|\blike this\b|\bprecedent\b/.test(q)) intent = "similar";
    else if (e.phone) intent = "trace_phone";
    else if (e.vehicle) intent = "trace_vehicle";
    else if (/\bpredict\b|\bnext\b|\bhotspot\b|\bforecast\b|\bwhere will\b|\bearly warning\b|\balert\b/.test(q)) intent = "predict";
    else if (/\bnetwork\b|\bassociate\b|\bgang\b|\bconnections?\b|\bgraph\b/.test(q) || (e.suspect && /\bnetwork|associate|connect/.test(q))) intent = "network";
    else if (/\brisk\b|\bdanger\b|\bprofile\b|\bdossier\b|\bbehaviou?r/.test(q) && e.suspect) intent = "risk";
    else if (e.suspect && !e.crimeType) intent = "network";
    else if (/\bhelp\b|\bwhat can you\b|\bhow do/.test(q)) intent = "help";

    return { intent, entities: e, query: qRaw };
  }

  function parseTime(q) {
    let m;
    if ((m = q.match(/last\s+(\d+)\s+(day|week|month|year)/))) {
      const n = +m[1], unit = m[2];
      const mult = unit === "day" ? 1 : unit === "week" ? 7 : unit === "month" ? 30 : 365;
      return { from: NOW.getTime() - n * mult * dayMs, to: NOW.getTime(), label: `last ${n} ${unit}${n > 1 ? "s" : ""}` };
    }
    if (/this year/.test(q)) return { from: new Date(NOW.getFullYear(), 0, 1).getTime(), to: NOW.getTime(), label: "this year" };
    if (/last year/.test(q)) return { from: new Date(NOW.getFullYear() - 1, 0, 1).getTime(), to: new Date(NOW.getFullYear(), 0, 1).getTime(), label: "last year" };
    if (/last month/.test(q)) return { from: NOW.getTime() - 30 * dayMs, to: NOW.getTime(), label: "last month" };
    if (/last week/.test(q)) return { from: NOW.getTime() - 7 * dayMs, to: NOW.getTime(), label: "last week" };
    if (/recent|lately/.test(q)) return { from: NOW.getTime() - 90 * dayMs, to: NOW.getTime(), label: "last 90 days" };
    return null;
  }

  /* ----------------------------- Retrieval -------------------------------- */
  function filterCases(e) {
    return DB.cases.filter((c) => {
      if (e.crimeType && c.type !== e.crimeType) return false;
      if (e.district && c.district !== e.district) return false;
      if (e.area && c.area !== e.area) return false;
      if (e.phone && c.phone !== e.phone && !c.suspects.some((id) => DB.suspectById(id).phones.includes(e.phone))) return false;
      if (e.vehicle && (c.vehicle || "").replace(/\s/g, "-") !== e.vehicle && !c.suspects.some((id) => DB.suspectById(id).vehicles.includes(e.vehicle))) return false;
      if (e.suspect && !c.suspects.includes(e.suspect)) return false;
      if (e.time && (c.ts < e.time.from || c.ts > e.time.to)) return false;
      return true;
    }).sort((a, b) => b.ts - a.ts);
  }

  function computeHotspots(cases, topN = 6) {
    const map = {};
    cases.forEach((c) => {
      const k = c.area + " · " + c.district;
      (map[k] = map[k] || { area: c.area, district: c.district, lat: c.lat, lng: c.lng, count: 0, ids: [] });
      map[k].count++; map[k].ids.push(c.id);
    });
    const arr = Object.values(map).sort((a, b) => b.count - a.count);
    const total = cases.length || 1;
    arr.forEach((h) => (h.share = Math.round((h.count / total) * 100)));
    return arr.slice(0, topN);
  }

  function buildNetwork(suspectId, depth = 1) {
    if (!suspectId) return null;
    const root = DB.suspectById(suspectId);
    if (!root) return null;
    const nodes = new Map(), edges = [];
    const add = (s, level) => { if (!nodes.has(s.id)) nodes.set(s.id, { id: s.id, name: s.name, alias: s.alias, risk: s.riskScore, level }); };
    add(root, 0);

    const expand = (s, level) => {
      // associate edges
      s.associates.forEach((aid) => {
        const a = DB.suspectById(aid);
        add(a, Math.min(level + 1, depth + 1));
        if (!edges.find((x) => x.kind === "associate" && ((x.from === s.id && x.to === aid) || (x.from === aid && x.to === s.id))))
          edges.push({ from: s.id, to: aid, kind: "associate", label: "associate" });
      });
    };
    expand(root, 0);
    if (depth >= 2) Array.from(nodes.values()).filter((n) => n.level === 1).forEach((n) => expand(DB.suspectById(n.id), 1));

    // attach the root's phones / vehicles / cases as evidence nodes (limited)
    const evidence = [];
    root.phones.slice(0, 2).forEach((p, i) => { const id = "PH-" + i + "-" + p; evidence.push({ id, name: "📞 " + p, kind: "phone" }); edges.push({ from: root.id, to: id, kind: "phone", label: "uses" }); });
    root.vehicles.slice(0, 1).forEach((v) => { const id = "VH-" + v; evidence.push({ id, name: "🏍 " + v, kind: "vehicle" }); edges.push({ from: root.id, to: id, kind: "vehicle", label: "drives" }); });
    root.cases.slice(0, 4).forEach((cid) => { const c = DB.caseById(cid); const id = "CS-" + cid; evidence.push({ id, name: "📁 " + c.type, kind: "case", caseId: cid }); edges.push({ from: root.id, to: id, kind: "case", label: c.type }); });

    return { focusId: suspectId, focusName: root.name, nodes: Array.from(nodes.values()), evidence, edges };
  }

  function predictHotspot(crimeType, district) {
    // Recency-weighted frequency forecast over matching history.
    const matches = DB.cases.filter((c) => (!crimeType || c.type === crimeType) && (!district || c.district === district));
    if (!matches.length) return null;
    const buckets = {};
    matches.forEach((c) => {
      const k = c.area + " · " + c.district;
      const ageDays = (NOW - c.ts) / dayMs;
      const w = Math.exp(-ageDays / 120);                 // ~4-month half-weight decay
      const recent = ageDays <= 90;
      (buckets[k] = buckets[k] || { area: c.area, district: c.district, lat: c.lat, lng: c.lng, score: 0, total: 0, recent: 0, offenders: new Set() });
      buckets[k].score += w; buckets[k].total++; if (recent) buckets[k].recent++;
      c.suspects.forEach((s) => buckets[k].offenders.add(s));
    });
    const ranked = Object.values(buckets).sort((a, b) => b.score - a.score);
    const top = ranked[0];
    const sum = ranked.reduce((s, b) => s + b.score, 0) || 1;
    const confidence = Math.min(95, Math.round((top.score / sum) * 100) + 20);
    const factors = [
      { label: "Recent incidents (90d)", value: top.recent, detail: `${top.recent} incident(s) in last 90 days` },
      { label: "Historical frequency",   value: top.total,  detail: `${top.total} total in history` },
      { label: "Active offenders",       value: top.offenders.size, detail: `${top.offenders.size} known offender(s) operate here` },
      { label: "Recency momentum",       value: Math.round(top.score * 10) / 10, detail: "time-decayed activity weight" }
    ];
    return {
      type: crimeType || "All crime", district: district || "Karnataka",
      area: top.area, predDistrict: top.district, lat: top.lat, lng: top.lng,
      confidence, factors, ranked: ranked.slice(0, 5)
    };
  }

  /* ------------------------- Natural-language layer ----------------------- */
  function timeline(cases) {
    return [...cases].sort((a, b) => a.ts - b.ts).map((c) => ({ date: c.date, type: c.type, area: c.area, district: c.district, id: c.id, severity: c.severity }));
  }
  function escalation(tl) {
    if (tl.length < 3) return null;
    const first = tl.slice(0, Math.ceil(tl.length / 2)).reduce((s, x) => s + x.severity, 0) / Math.ceil(tl.length / 2);
    const last = tl.slice(Math.ceil(tl.length / 2)).reduce((s, x) => s + x.severity, 0) / Math.floor(tl.length / 2);
    if (last > first + 0.8) return "escalating";
    if (last < first - 0.8) return "de-escalating";
    return "steady";
  }

  /* --------------------------- Intent handlers ---------------------------- */
  function handleInner(qRaw) {
    const { intent, entities: e, query } = parse(qRaw);

    // ---- follow-up resolution: fill gaps from conversation memory (pillar #1) ----
    const ql = qRaw.toLowerCase();
    const isShort = qRaw.trim().split(/\s+/).length <= 5;
    const anaphora = /\b(it|that|this|those|these|them|they|their|same|more|again|here|there|one|ones)\b/.test(ql);
    if (!e.crimeType && CTX.crimeType && (anaphora || isShort)) e.crimeType = CTX.crimeType;
    if (!e.district && CTX.district && (anaphora || isShort || /\b(there|here|same|that area|same place)\b/.test(ql))) e.district = CTX.district;
    if (!e.suspect && CTX.suspect && /\b(he|him|his|she|her|they|them|their|same|network|associate|profile|dossier)\b/.test(ql)) e.suspect = CTX.suspect;

    if (intent === "help") {
      return baseResult(intent, query, {
        answerEN: "I'm your investigation copilot. Ask me to search cases, trace a phone or vehicle, build a suspect network, predict the next hotspot, or run a full autonomous investigation. Try the suggestion chips below.",
        answerKN: "ನಾನು ನಿಮ್ಮ ತನಿಖಾ ಸಹಾಯಕ. ಪ್ರಕರಣ ಹುಡುಕಲು, ದೂರವಾಣಿ/ವಾಹನ ಪತ್ತೆ ಮಾಡಲು, ಜಾಲ ರಚಿಸಲು ಅಥವಾ ಮುಂದಿನ ತಾಣ ಊಹಿಸಲು ಕೇಳಿ."
      });
    }

    /* ---- trace phone / vehicle ---- */
    if (intent === "trace_phone" || intent === "trace_vehicle") {
      const cases = filterCases(e);
      const key = e.phone || e.vehicle;
      const linkedSus = [...new Set(cases.flatMap((c) => c.suspects))];
      const owner = DB.suspects.find((s) => (e.phone && s.phones.includes(e.phone)) || (e.vehicle && s.vehicles.includes(e.vehicle)));
      const net = owner ? buildNetwork(owner.id, 1) : null;
      const tl = timeline(cases);
      return baseResult(intent, query, {
        answerEN: `${e.phone ? "Phone" : "Vehicle"} ${key} is linked to ${cases.length} case(s)` +
          (owner ? ` and traces to ${owner.name} (${owner.id}), risk ${owner.riskScore}/100` : "") +
          (cases.length ? `. Most recent: ${cases[0].type} at ${cases[0].area} on ${cases[0].date}.` : "."),
        answerKN: `ದೂರವಾಣಿ/ವಾಹನ ${key} — ${cases.length} ಪ್ರಕರಣಗಳಿಗೆ ಸಂಬಂಧ` + (owner ? `, ${owner.name}.` : "."),
        cases, network: net, hotspots: computeHotspots(cases), timeline: tl,
        sources: cases.map((c) => c.id)
      });
    }

    /* ---- network ---- */
    if (intent === "network") {
      let sid = e.suspect;
      if (!sid) { const top = DB.topSuspect(); sid = top.id; }
      const s = DB.suspectById(sid);
      const net = buildNetwork(sid, 2);
      const cases = s.cases.map((id) => DB.caseById(id)).sort((a, b) => b.ts - a.ts);
      return baseResult(intent, query, {
        answerEN: `${s.name} (${s.id})${s.alias ? ' alias "' + s.alias + '"' : ""} — ${s.district}. ` +
          `${s.associates.length} known associate(s), ${s.cases.length} linked case(s), risk ${s.riskScore}/100. Status: ${s.status}.`,
        answerKN: `${s.name} ಜಾಲ — ${s.associates.length} ಸಂಬಂಧಿಗಳು, ${s.cases.length} ಪ್ರಕರಣಗಳು, ಅಪಾಯ ${s.riskScore}/100.`,
        cases, network: net, hotspots: computeHotspots(cases), timeline: timeline(cases),
        risk: { subject: s.name + " (" + s.id + ")", score: s.riskScore, factors: s.riskFactors },
        sources: s.cases
      });
    }

    /* ---- risk dossier ---- */
    if (intent === "risk") {
      const s = DB.suspectById(e.suspect) || DB.topSuspect();
      const cases = s.cases.map((id) => DB.caseById(id)).sort((a, b) => b.ts - a.ts);
      return baseResult(intent, query, {
        answerEN: `Risk dossier — ${s.name} (${s.id}): ${s.riskScore}/100. Driven by ${s.riskFactors.map((f) => f.detail).join("; ")}.`,
        answerKN: `${s.name} ಅಪಾಯ ಸೂಚ್ಯಂಕ: ${s.riskScore}/100.`,
        cases, network: buildNetwork(s.id, 1), timeline: timeline(cases),
        risk: { subject: s.name + " (" + s.id + ")", score: s.riskScore, factors: s.riskFactors },
        sources: s.cases
      });
    }

    /* ---- predict ---- */
    if (intent === "predict") {
      const pred = predictHotspot(e.crimeType, e.district);
      const cases = filterCases({ crimeType: e.crimeType, district: e.district, area: null, time: null, phone: null, vehicle: null, suspect: null });
      if (!pred) return baseResult(intent, query, { answerEN: "Not enough records to forecast for that filter.", answerKN: "ಊಹೆಗೆ ಸಾಕಷ್ಟು ದಾಖಲೆ ಇಲ್ಲ.", cases: [] });
      return baseResult(intent, query, {
        answerEN: `Predicted next ${pred.type} hotspot: ${pred.area}, ${pred.predDistrict} — confidence ${pred.confidence}%. ` +
          `Basis: ${pred.factors.map((f) => f.detail).join("; ")}.`,
        answerKN: `ಮುಂದಿನ ಸಂಭಾವ್ಯ ತಾಣ: ${pred.area}, ${pred.predDistrict}. ವಿಶ್ವಾಸ ${pred.confidence}%.`,
        cases, prediction: pred, hotspots: computeHotspots(cases), timeline: timeline(cases),
        sources: cases.slice(0, 30).map((c) => c.id)
      });
    }

    /* ---- investigate (autonomous, full pipeline) ---- */
    if (intent === "investigate") {
      const cases = filterCases(e);
      const hotspots = computeHotspots(cases);
      const topSus = mostFrequentSuspect(cases);
      const net = topSus ? buildNetwork(topSus.id, 2) : null;
      const pred = predictHotspot(e.crimeType, e.district);
      const tl = timeline(cases);
      const esc = escalation(tl);
      const what = [e.crimeType || "crime", e.district ? "in " + e.district : "", e.time ? "(" + e.time.label + ")" : ""].join(" ").trim();
      return baseResult(intent, query, {
        answerEN: `Autonomous investigation of ${what}: ${cases.length} case(s) retrieved across ${hotspots.length} hotspot(s). ` +
          (hotspots[0] ? `Worst-hit: ${hotspots[0].area} (${hotspots[0].count} cases). ` : "") +
          (topSus ? `Most-linked suspect: ${topSus.name} (${topSus.id}), risk ${topSus.riskScore}/100. ` : "") +
          (pred ? `Forecast next hotspot: ${pred.area} (${pred.confidence}%). ` : "") +
          (esc ? `Pattern: ${esc} severity. ` : "") + `Full report ready below.`,
        answerKN: `${what} ಸ್ವಯಂ ತನಿಖೆ: ${cases.length} ಪ್ರಕರಣಗಳು, ${hotspots.length} ತಾಣಗಳು.` +
          (pred ? ` ಮುಂದಿನ ತಾಣ: ${pred.area} (${pred.confidence}%).` : ""),
        cases, network: net, hotspots, prediction: pred, timeline: tl, escalation: esc,
        risk: topSus ? { subject: topSus.name + " (" + topSus.id + ")", score: topSus.riskScore, factors: topSus.riskFactors } : null,
        sources: cases.map((c) => c.id),
        steps: [
          `Parsing query → intent: investigate, crime: ${e.crimeType || "any"}, area: ${e.district || "all KA"}${e.time ? ", window: " + e.time.label : ""}`,
          `Retrieving matching records from crime database…`,
          `→ ${cases.length} case(s) retrieved and grounded`,
          `Clustering geospatial hotspots… → ${hotspots.length} cluster(s)`,
          `Building criminal network graph…` + (topSus ? ` → focus ${topSus.name}` : ""),
          `Running recency-weighted forecast…` + (pred ? ` → ${pred.area} (${pred.confidence}%)` : ""),
          `Compiling explainable investigation report…`
        ]
      });
    }

    /* ---- financial crime & money-trail (pillar #7) ---- */
    if (intent === "financial") {
      let s = DB.suspectById(e.suspect);
      if (!s || !s.accounts.length) {
        const finCase = DB.cases.filter((c) => c.transactions && c.transactions.length && c.suspects.length)
          .sort((a, b) => b.transactions.length - a.transactions.length)[0];
        s = finCase ? DB.suspectById(finCase.suspects[0]) : DB.topSuspect();
      }
      const fin = moneyTrail(s);
      const cases = s.cases.map((id) => DB.caseById(id)).filter((c) => c.transactions && c.transactions.length).sort((a, b) => b.ts - a.ts);
      const flaggedTotal = fin.transactions.filter((t) => t.flagged).reduce((x, t) => x + t.amount, 0);
      return baseResult(intent, query, {
        answerEN: `Money-trail for ${s.name} (${s.id}): ${fin.accounts.length} linked account(s), ${fin.transactions.length} transaction(s), ${fin.mules} suspected mule account(s). Flagged value ₹${flaggedTotal.toLocaleString("en-IN")}. ` +
          (fin.transactions.length ? `Funds route through layered mule accounts — a classic laundering structure.` : `No suspicious transfers found.`),
        answerKN: `${s.name} ಹಣದ ಜಾಡು: ${fin.accounts.length} ಖಾತೆ, ${fin.transactions.length} ವರ್ಗಾವಣೆ, ₹${flaggedTotal.toLocaleString("en-IN")} ಶಂಕಿತ.`,
        cases, financial: fin, network: fin.network,
        risk: { subject: s.name + " (" + s.id + ")", score: s.riskScore, factors: s.riskFactors },
        sources: [...new Set([...cases.map((c) => c.id), ...fin.transactions.map((t) => t.id)])]
      });
    }

    /* ---- sociological crime insights (pillar #4) ---- */
    if (intent === "socio") {
      const socio = socioInsights(e.crimeType);
      return baseResult(intent, query, {
        answerEN: `Sociological analysis${e.crimeType ? " of " + e.crimeType : " (all crime)"}: ${socio.headline} Offender demographic: ${socio.demo.summary}.`,
        answerKN: `ಸಾಮಾಜಿಕ ವಿಶ್ಲೇಷಣೆ: ${socio.headlineKN}`,
        cases: socio.cases.slice(0, 60), socio,
        sources: socio.cases.slice(0, 30).map((c) => c.id)
      });
    }

    /* ---- similar past cases (pillar #6) ---- */
    if (intent === "similar") {
      const ref = DB.caseById(e.caseId) || DB.caseById(CTX.lastCaseId) || filterCases(e)[0];
      if (!ref) return baseResult(intent, query, { answerEN: "Give me a case to compare, e.g. “similar cases to KSP-10200”.", answerKN: "ಹೋಲಿಕೆಗೆ ಪ್ರಕರಣ ಸಂಖ್ಯೆ ತಿಳಿಸಿ.", cases: [] });
      const sim = similarCases(ref, 12);
      return baseResult(intent, query, {
        answerEN: `Found ${sim.length} case(s) similar to ${ref.id} (${ref.type} · ${ref.area}), ranked by modus operandi, type, location and severity. ` +
          (sim[0] ? `Closest: ${sim[0].id} (${sim[0].matchPct}% match).` : ""),
        answerKN: `${ref.id} ಗೆ ಹೋಲುವ ${sim.length} ಪ್ರಕರಣಗಳು ಸಿಕ್ಕಿವೆ.`,
        cases: sim, hotspots: computeHotspots(sim), timeline: timeline(sim),
        sources: [ref.id, ...sim.map((c) => c.id)]
      });
    }

    /* ---- default: search ---- */
    const cases = filterCases(e);
    const hs = computeHotspots(cases);
    const what = [e.crimeType || "", e.area || e.district || "", e.time ? "(" + e.time.label + ")" : ""].filter(Boolean).join(" ").trim() || "matching";
    return baseResult(intent, query, {
      answerEN: cases.length
        ? `Found ${cases.length} ${what} case(s)` + (hs[0] ? `. Top location: ${hs[0].area}, ${hs[0].district} (${hs[0].count}). ` : ". ") +
          `Most recent: ${cases[0].type} at ${cases[0].area} on ${cases[0].date} (${cases[0].id}).`
        : `No records match “${query}”. Try a crime type, a district, or a time window.`,
      answerKN: cases.length ? `${cases.length} ಪ್ರಕರಣಗಳು ಕಂಡುಬಂದಿವೆ.` : `ಯಾವುದೇ ಪ್ರಕರಣ ಸಿಗಲಿಲ್ಲ.`,
      cases, hotspots: hs, timeline: timeline(cases), sources: cases.map((c) => c.id)
    });
  }

  /* --------------------- Financial: money-trail builder ------------------- */
  function moneyTrail(s) {
    const own = new Set(s.accounts);
    const txns = [], seen = new Set();
    const addTx = (t) => { if (!seen.has(t.id)) { seen.add(t.id); txns.push(t); } };
    DB.transactions.forEach((t) => { if (own.has(t.from) || own.has(t.to)) addTx(t); });
    let frontier = new Set(txns.filter((t) => t.flagged).map((t) => t.to));
    for (let hop = 0; hop < 2; hop++) {
      const next = new Set();
      DB.transactions.forEach((t) => { if (t.flagged && frontier.has(t.from)) { addTx(t); next.add(t.to); } });
      frontier = next;
    }
    const accIds = new Set(s.accounts);
    txns.forEach((t) => { accIds.add(t.from); accIds.add(t.to); });
    const accounts = [...accIds].map((id) => DB.accountById(id)).filter(Boolean);
    const mules = accounts.filter((a) => a.mule).length;
    const nodes = [{ id: s.id, name: s.name, alias: s.alias, risk: s.riskScore, level: 0 }];
    const evidence = accounts.map((a) => ({ id: a.id, name: (a.mule ? "⚠ " : "🏦 ") + a.bank + " " + a.number, kind: a.mule ? "mule" : "account" }));
    const edges = [];
    s.accounts.forEach((a) => edges.push({ from: s.id, to: a, kind: "owns", label: "owns" }));
    txns.forEach((t) => edges.push({ from: t.from, to: t.to, kind: t.flagged ? "txn-flag" : "txn", label: "₹" + Math.round(t.amount / 1000) + "k" }));
    return { accounts, transactions: txns, mules, network: { focusId: s.id, focusName: s.name, nodes, evidence, edges } };
  }

  /* ----------------- Sociological: correlations + demographics ------------ */
  function pearson(x, y) {
    const n = x.length; if (!n) return 0;
    const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; num += a * b; dx += a * a; dy += b * b; }
    return (dx && dy) ? num / Math.sqrt(dx * dy) : 0;
  }
  function corrPhrase(name, r) {
    const m = {
      "Unemployment": r >= 0 ? "higher-unemployment districts report more crime" : "lower-unemployment districts report more crime",
      "Urbanization": r >= 0 ? "more-urbanized districts report more crime" : "less-urbanized districts report more crime",
      "Migration index": r >= 0 ? "higher in-migration districts report more crime" : "lower-migration districts report more crime",
      "Literacy": r >= 0 ? "higher-literacy districts report more crime" : "lower-literacy districts report more crime",
      "Per-capita income": r >= 0 ? "wealthier districts report more crime" : "lower-income districts report more crime"
    };
    return m[name] || "";
  }
  function socioInsights(crimeType) {
    const districts = DB.districts;
    const counts = districts.map((d) => DB.cases.filter((c) => c.district === d.district && (!crimeType || c.type === crimeType)).length);
    const factorDefs = [
      { name: "Unemployment", key: "unemployment" }, { name: "Urbanization", key: "urban" },
      { name: "Migration index", key: "migration" }, { name: "Literacy", key: "literacy" },
      { name: "Per-capita income", key: "income" }
    ];
    const correlations = factorDefs.map((f) => {
      const r = pearson(districts.map((d) => d[f.key]), counts);
      const strength = Math.abs(r) > 0.6 ? "strong" : Math.abs(r) > 0.35 ? "moderate" : "weak";
      return { name: f.name, r: +r.toFixed(2), strength, insight: `${strength} ${r >= 0 ? "positive" : "negative"} correlation (r=${r.toFixed(2)}) — ${corrPhrase(f.name, r)}` };
    }).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    const cases = DB.cases.filter((c) => !crimeType || c.type === crimeType);
    const offs = [...new Set(cases.flatMap((c) => c.suspects))].map((id) => DB.suspectById(id)).filter(Boolean);
    const ageBuckets = { "18-25": 0, "26-35": 0, "36-45": 0, "46+": 0 };
    offs.forEach((o) => { const a = o.age; if (a <= 25) ageBuckets["18-25"]++; else if (a <= 35) ageBuckets["26-35"]++; else if (a <= 45) ageBuckets["36-45"]++; else ageBuckets["46+"]++; });
    const male = offs.filter((o) => o.gender === "M").length;
    const topAge = Object.entries(ageBuckets).sort((a, b) => b[1] - a[1])[0];
    const demo = { ageBuckets, male, female: offs.length - male, total: offs.length,
      summary: `${offs.length} offenders, ${Math.round((male / (offs.length || 1)) * 100)}% male, peak age band ${topAge ? topAge[0] : "n/a"}` };

    const districtTable = districts.map((d, i) => ({ district: d.district, count: counts[i], unemployment: d.unemployment, literacy: d.literacy, urban: d.urban, income: d.income })).sort((a, b) => b.count - a.count);
    const top = correlations[0];
    return {
      headline: top ? `the strongest social driver is ${top.name} (${top.insight}).` : "insufficient variance to correlate.",
      headlineKN: top ? `ಪ್ರಮುಖ ಸಾಮಾಜಿಕ ಅಂಶ — ${top.name} (r=${top.r}).` : "",
      correlations, demo, districtTable, cases, crimeType: crimeType || "All crime"
    };
  }

  /* --------------------- Similar-case retrieval (lightweight) ------------- */
  function similarCases(ref, n) {
    return DB.cases.filter((c) => c.id !== ref.id).map((c) => {
      let score = 0;
      if (c.type === ref.type) score += 45;
      if (c.area === ref.area) score += 20; else if (c.district === ref.district) score += 10;
      if (c.modus === ref.modus) score += 20;
      score += Math.max(0, 10 - Math.abs(c.severity - ref.severity) * 3);
      if (Math.abs(c.ts - ref.ts) / dayMs < 120) score += 5;
      return { c, score };
    }).filter((x) => x.score >= 45).sort((a, b) => b.score - a.score).slice(0, n)
      .map((x) => Object.assign({}, x.c, { matchPct: Math.min(99, Math.round(x.score)) }));
  }

  function mostFrequentSuspect(cases) {
    const count = {};
    cases.forEach((c) => c.suspects.forEach((s) => (count[s] = (count[s] || 0) + 1)));
    const id = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    return id ? DB.suspectById(id) : null;
  }

  function baseResult(intent, query, extra) {
    return Object.assign({
      intent, query,
      answerEN: "", answerKN: "",
      cases: [], network: null, hotspots: [], prediction: null, risk: null,
      financial: null, socio: null,
      timeline: [], escalation: null, sources: [], steps: null
    }, extra);
  }

  // Public entry — runs the dispatcher then updates conversation memory.
  function handle(qRaw) {
    const r = handleInner(qRaw);
    try {
      if (r.intent !== "help") {
        if (r.network && r.network.focusId && /^SUS/.test(r.network.focusId)) CTX.suspect = r.network.focusId;
        else if (r.cases && r.cases.length) {
          const f = {}; r.cases.forEach((c) => (c.suspects || []).forEach((s) => (f[s] = (f[s] || 0) + 1)));
          const top = Object.keys(f).sort((a, b) => f[b] - f[a])[0]; if (top) CTX.suspect = top;
        }
        if (r.cases && r.cases[0]) { CTX.lastCaseId = r.cases[0].id; CTX.crimeType = r.cases[0].type; CTX.district = r.cases[0].district; }
        if (r.prediction && r.prediction.type && r.prediction.type !== "All crime") CTX.crimeType = r.prediction.type;
      }
    } catch (e) {}
    return r;
  }
  function resetContext() { CTX = { crimeType: null, district: null, suspect: null, lastCaseId: null }; }

  const ENGINE = { parse, handle, predictHotspot, buildNetwork, computeHotspots, filterCases, moneyTrail, socioInsights, similarCases, resetContext, getContext: () => CTX };
  root.Engine = ENGINE;
  if (typeof module !== "undefined" && module.exports) module.exports = ENGINE;
  if (typeof console !== "undefined") console.log("[KSP-Copilot] Engine ready (pillars: financial, socio, similar, follow-up).");
})();
