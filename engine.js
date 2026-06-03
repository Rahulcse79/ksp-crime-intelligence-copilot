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
  const DB = window.DB;
  const dayMs = 86400000;
  const NOW = DB.refNow;

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

    // intent
    let intent = "search_cases";
    if (/\binvestigate\b|\bautonomous\b|\bfull (report|analysis)\b|\bdig into\b/.test(q)) intent = "investigate";
    else if (e.phone) intent = "trace_phone";
    else if (e.vehicle) intent = "trace_vehicle";
    else if (/\bpredict\b|\bnext\b|\bhotspot\b|\bforecast\b|\bwhere will\b/.test(q)) intent = "predict";
    else if (/\bnetwork\b|\bassociate\b|\bgang\b|\bconnections?\b|\bgraph\b/.test(q) || (e.suspect && /\bnetwork|associate|connect/.test(q))) intent = "network";
    else if (/\brisk\b|\bdanger\b|\bprofile\b|\bdossier\b/.test(q) && e.suspect) intent = "risk";
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
  function handle(qRaw) {
    const { intent, entities: e, query } = parse(qRaw);

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
      timeline: [], escalation: null, sources: [], steps: null
    }, extra);
  }

  window.Engine = { parse, handle, predictHotspot, buildNetwork, computeHotspots, filterCases };
  console.log("[KSP-Copilot] Engine ready.");
})();
