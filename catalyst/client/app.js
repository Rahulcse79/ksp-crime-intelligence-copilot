/* ============================================================================
 * app.js  —  UI orchestration for the KSP Crime Intelligence Copilot
 * Ties together: bilingual UI, voice I/O, chat, Leaflet map, vis-network graph,
 * explainable forecast/risk, timeline, evidence table, audit log, PDF report,
 * and the headline "Autonomous Investigation" sequence.
 * ==========================================================================*/
(function () {
  "use strict";
  const DB = window.DB, Engine = window.Engine;
  const $ = (s) => document.querySelector(s);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let LANG = "en";
  let THEME = (function () { try { return localStorage.getItem("ksp_theme") || "dark"; } catch (e) { return "dark"; } })();
  let mapObj, heatLayer, markerGroup, predMarker, netObj, tileLayer;
  let lastResult = null;
  const themeText = () => getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#e8eefc";
  const themeMuted = () => getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#8a98b8";
  const trackCol = () => (THEME === "light" ? "#e3eaf4" : "#16223b");
  const gridCol = () => (THEME === "light" ? "#e0e7f1" : "#1f2d49");
  const heatGradient = () => (THEME === "light"
    ? { 0.2: "#5b3df5", 0.5: "#2f6fe0", 0.75: "#ff8a00", 1: "#e23a40" }
    : { 0.2: "#4f8cff", 0.5: "#34d7e6", 0.75: "#ffb020", 1: "#ff5a5f" });

  // Pillar #10 — role-based access & governance.
  const ROLES = {
    Investigator: { scope: "Full case, network, financial & report access", financial: true, pii: true },
    Analyst:      { scope: "Analytics & trends · financial restricted",     financial: false, pii: true },
    Supervisor:   { scope: "Full access + oversight & audit trail",          financial: true, pii: true },
    Policymaker:  { scope: "Aggregate analytics only · PII masked",          financial: false, pii: false }
  };
  let ROLE = "Investigator";
  const maskName = (s) => ROLES[ROLE].pii ? s : s.replace(/[A-Za-z]+\s[A-Za-z]+/g, "Subject");

  /* ------------------------------ i18n ------------------------------------ */
  const STRINGS = {
    en: {
      tagline: "Agentic Investigation Copilot · ಅಪರಾಧ ಗುಪ್ತಚರ ಸಹಾಯಕ",
      role: "Inspector · Crime Branch", copilot: "🤖 Investigation Copilot",
      grounded: "Grounded · 0 hallucination", map: "🗺️ Crime Hotspot Map",
      mapSub: "Live geospatial intelligence", network: "🕸️ Criminal Network",
      netSub: "Click a node to expand", forecast: "🔮 Forecast & Risk", xai: "Explainable AI",
      socio: "🏙️ Sociological Insights", socioSub: "Criminology · socio-economic correlation", trylabel: "💡 Try",
      timeline: "📈 Investigation Timeline", evidence: "📁 Evidence & Report",
      genreport: "Generate PDF Report", audit: "Audit log",
      synthetic: "Synthetic demo data — no real persons or cases",
      ph_forecast: "Run a prediction or open a suspect to see explainable scoring.",
      ph_timeline: "Cases will plot here chronologically with pattern detection.",
      ph_evidence: "Matching case records (with citations) appear here.",
      stats: ["Total Cases", "Known Suspects", "Districts", "Open / Under Inv."],
      greeting: "Namaskara, Inspector. I'm your Crime Intelligence Copilot. Ask me to search cases, trace a phone/vehicle, map hotspots, build a criminal network, forecast the next hotspot, or run a full autonomous investigation — and I'll generate a report. Every answer is grounded in records with citations.",
      sources: "Sources", more: "more", listening: "🎙️ Listening…",
      noVoice: "Voice not supported in this browser — please type.",
      thinking: "Thinking", placeArea: "Top location", report: "Report ready ✓"
    },
    kn: {
      tagline: "ಸ್ವಯಂಚಾಲಿತ ತನಿಖಾ ಸಹಾಯಕ · Agentic Investigation Copilot",
      role: "ಇನ್ಸ್‌ಪೆಕ್ಟರ್ · ಅಪರಾಧ ವಿಭಾಗ", copilot: "🤖 ತನಿಖಾ ಸಹಾಯಕ",
      grounded: "ದೃಢೀಕೃತ · ಶೂನ್ಯ ತಪ್ಪು", map: "🗺️ ಅಪರಾಧ ತಾಣ ನಕ್ಷೆ",
      mapSub: "ನೇರ ಭೌಗೋಳಿಕ ಗುಪ್ತಚರ", network: "🕸️ ಅಪರಾಧಿ ಜಾಲ",
      netSub: "ವಿಸ್ತರಿಸಲು ನೋಡ್ ಕ್ಲಿಕ್ ಮಾಡಿ", forecast: "🔮 ಊಹೆ ಮತ್ತು ಅಪಾಯ", xai: "ವಿವರಿಸಬಲ್ಲ AI",
      socio: "🏙️ ಸಾಮಾಜಿಕ ಒಳನೋಟ", socioSub: "ಅಪರಾಧಶಾಸ್ತ್ರ · ಸಾಮಾಜಿಕ-ಆರ್ಥಿಕ ಸಂಬಂಧ", trylabel: "💡 ಪ್ರಯತ್ನಿಸಿ",
      timeline: "📈 ತನಿಖಾ ಕಾಲರೇಖೆ", evidence: "📁 ಸಾಕ್ಷ್ಯ ಮತ್ತು ವರದಿ",
      genreport: "PDF ವರದಿ ರಚಿಸಿ", audit: "ಲೆಕ್ಕಪರಿಶೋಧನೆ",
      synthetic: "ಕೃತಕ ಡೆಮೋ ಮಾಹಿತಿ — ನಿಜವಾದ ವ್ಯಕ್ತಿಗಳಲ್ಲ",
      ph_forecast: "ಊಹೆ ಅಥವಾ ಶಂಕಿತನ ಮಾಹಿತಿಗೆ ಪ್ರಶ್ನಿಸಿ.",
      ph_timeline: "ಪ್ರಕರಣಗಳು ಇಲ್ಲಿ ಕಾಲಾನುಕ್ರಮವಾಗಿ ಕಾಣಿಸುತ್ತವೆ.",
      ph_evidence: "ಸಂಬಂಧಿತ ಪ್ರಕರಣಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.",
      stats: ["ಒಟ್ಟು ಪ್ರಕರಣಗಳು", "ಶಂಕಿತರು", "ಜಿಲ್ಲೆಗಳು", "ತೆರೆದ ಪ್ರಕರಣಗಳು"],
      greeting: "ನಮಸ್ಕಾರ, ಇನ್ಸ್‌ಪೆಕ್ಟರ್. ನಾನು ನಿಮ್ಮ ಅಪರಾಧ ಗುಪ್ತಚರ ಸಹಾಯಕ. ಪ್ರಕರಣ ಹುಡುಕಲು, ದೂರವಾಣಿ/ವಾಹನ ಪತ್ತೆ, ತಾಣ ನಕ್ಷೆ, ಅಪರಾಧಿ ಜಾಲ, ಮುಂದಿನ ತಾಣದ ಊಹೆ ಅಥವಾ ಸಂಪೂರ್ಣ ಸ್ವಯಂ ತನಿಖೆ ಕೇಳಿ. ಪ್ರತಿ ಉತ್ತರವೂ ದಾಖಲೆ ಆಧಾರಿತ.",
      sources: "ಆಧಾರಗಳು", more: "ಇನ್ನಷ್ಟು", listening: "🎙️ ಆಲಿಸುತ್ತಿದೆ…",
      noVoice: "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಬೆಂಬಲವಿಲ್ಲ — ಟೈಪ್ ಮಾಡಿ.",
      thinking: "ಆಲೋಚಿಸುತ್ತಿದೆ", placeArea: "ಪ್ರಮುಖ ಸ್ಥಳ", report: "ವರದಿ ಸಿದ್ಧ ✓"
    }
  };
  const T = () => STRINGS[LANG];

  /* ---------------------------- Boot sequence ----------------------------- */
  function boot() {
    document.documentElement.setAttribute("data-theme", THEME);
    $("#themeToggle").textContent = THEME === "light" ? "🌙" : "☀️";
    $("#roleText").textContent = ROLE;
    $("#roleBadge").title = ROLES[ROLE].scope;
    loadAudit();
    renderStats();
    applyLang();
    startClock();
    initMap();
    renderSuggestions();
    addBot(T().greeting);
    // seed visuals so panels aren't empty
    showInitialHeat();
    const top = DB.topSuspect();
    renderNetwork(Engine.buildNetwork(top.id, 2));
    $("#netSub").textContent = top.name + " · risk " + top.riskScore;
    audit("session.start", ROLE);
    bindEvents();
  }

  function renderStats() {
    const s = DB.stats();
    const labels = T().stats;
    const vals = [s.cases, s.suspects, s.districts, s.open];
    $("#stats").innerHTML = vals.map((v, i) =>
      `<div class="stat s${i + 1}"><div class="num">${v}</div><div class="lbl">${labels[i]}</div></div>`
    ).join("");
  }

  function applyLang() {
    document.body.classList.toggle("kn", LANG === "kn");
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const k = node.getAttribute("data-i18n");
      if (T()[k]) node.textContent = T()[k];
    });
    $("#queryInput").placeholder = LANG === "kn"
      ? "ಕೇಳಿ… ಉದಾ. ಬೆಂಗಳೂರಿನಲ್ಲಿ chain snatching ತನಿಖೆ"
      : "Ask anything… e.g. Investigate chain snatching in Bengaluru";
    renderStats();
  }

  function startClock() {
    const tick = () => { $("#clock").textContent = new Date().toLocaleTimeString("en-GB"); };
    tick(); setInterval(tick, 1000);
  }

  /* ----------------------------- Suggestions ------------------------------ */
  function renderSuggestions() {
    const phone = DB.sampleHotPhone();
    const sus = DB.topSuspect();
    const simCase = (DB.cases.find((c) => c.type === "Chain Snatching") || DB.cases[0]).id;
    const chips = [
      "Investigate chain snatching in Bengaluru",
      "Show the money trail",
      "Sociological insights for vehicle theft",
      "Network for " + sus.name,
      "Find similar cases to " + simCase,
      "Predict next chain snatching hotspot in Bengaluru",
      "Trace phone " + phone
    ];
    const box = $("#suggestions"); box.innerHTML = "";
    chips.forEach((c) => {
      const b = el("button", "chip", c);
      b.onclick = () => ask(c);
      box.appendChild(b);
    });
  }

  /* ------------------------------- Chat ----------------------------------- */
  function addUser(text) {
    const c = $("#chat"); c.appendChild(el("div", "msg user", escapeHtml(text)));
    c.scrollTop = c.scrollHeight;
  }
  function addBot(text, sources) {
    const c = $("#chat");
    let html = escapeHtml(text);
    if (sources && sources.length) {
      const shown = sources.slice(0, 6).map((s) => "<b>" + s + "</b>").join(", ");
      const extra = sources.length > 6 ? ` (+${sources.length - 6} ${T().more})` : "";
      html += `<div class="src">${T().sources}: ${shown}${extra}</div>`;
    }
    c.appendChild(el("div", "msg bot", html));
    c.scrollTop = c.scrollHeight;
  }
  function addThink() {
    const c = $("#chat");
    const box = el("div", "msg think");
    c.appendChild(box); c.scrollTop = c.scrollHeight;
    return box;
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m])); }

  /* ---------------------------- Ask pipeline ------------------------------ */
  async function ask(text, opts) {
    opts = opts || {};
    text = (text || $("#queryInput").value).trim();
    if (!text) return;
    $("#queryInput").value = "";
    addUser(text);
    audit("query", text.slice(0, 48));

    const result = Engine.handle(text);

    // RBAC enforcement (pillar #10)
    if (result.intent === "financial" && !ROLES[ROLE].financial) {
      audit("access.denied", "financial · " + ROLE);
      addBot(`🔒 Access restricted. Financial money-trail analysis requires Investigator or Supervisor. Your role (${ROLE}) scope: ${ROLES[ROLE].scope}.`);
      return;
    }
    // PII governance — mask names for non-PII roles
    if (!ROLES[ROLE].pii) {
      result.answerEN = maskAnswer(result.answerEN);
      result.answerKN = maskAnswer(result.answerKN);
      if (result.risk) result.risk.subject = maskAnswer(result.risk.subject);
    }
    lastResult = result;

    if (result.intent === "investigate" && result.steps) {
      await runAutonomous(result);
    } else {
      applyPanels(result);
      const answer = LANG === "kn" ? result.answerKN : result.answerEN;
      addBot(answer, result.sources);
      speak(answer);
    }
    enableReport(result);
  }
  function maskAnswer(t) { return (t || "").replace(/[A-Z][a-z]+\s[A-Z][a-z]+\s*\((SUS-\d+)\)/g, "Subject ($1)"); }

  /* ------------------- Headline: Autonomous Investigation ----------------- */
  async function runAutonomous(result) {
    applySocio(result); // hide socio panel (investigate has no socio block)
    const box = addThink();
    const steps = result.steps;
    const actions = [null, null, () => applyEvidence(result), () => applyMap(result),
                     () => applyNetwork(result), () => applyForecast(result), () => applyTimeline(result)];
    for (let i = 0; i < steps.length; i++) {
      const row = el("div", "step", `<span class="spinner"></span><span>${escapeHtml(steps[i])}</span>`);
      box.appendChild(row); $("#chat").scrollTop = $("#chat").scrollHeight;
      await sleep(640);
      row.querySelector(".spinner").outerHTML = `<span class="tick">✓</span>`;
      if (actions[i]) actions[i]();
    }
    await sleep(200);
    const answer = LANG === "kn" ? result.answerKN : result.answerEN;
    addBot(answer, result.sources);
    speak(answer);
  }

  /* --------------------------- Panel updaters ----------------------------- */
  function applyPanels(r) { applyMap(r); applyNetwork(r); applyForecast(r); applySocio(r); applyTimeline(r); applyEvidence(r); }

  /* ---- Map ---- */
  function initMap() {
    if (typeof L === "undefined") { $("#map").innerHTML = '<div class="placeholder">Map library offline.</div>'; return; }
    mapObj = L.map("map", { zoomControl: true, attributionControl: false }).setView([14.6, 76.2], 7);
    swapMapTiles();
    markerGroup = L.layerGroup().addTo(mapObj);
    injectPredCss();
  }
  function swapMapTiles() {
    // Theme-aware basemap: light tiles in light mode, dark tiles in dark mode.
    if (!mapObj || typeof L === "undefined") return;
    if (tileLayer) mapObj.removeLayer(tileLayer);
    const url = THEME === "light"
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    tileLayer = L.tileLayer(url, { maxZoom: 19, subdomains: "abcd" }).addTo(mapObj);
    if (tileLayer.bringToBack) tileLayer.bringToBack();
  }
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", THEME);
    const btn = $("#themeToggle"); if (btn) btn.textContent = THEME === "light" ? "🌙" : "☀️";
    swapMapTiles();
    if (lastResult) applyPanels(lastResult);
    else if (mapObj) { const top = DB.topSuspect(); renderNetwork(Engine.buildNetwork(top.id, 2)); }
    try { localStorage.setItem("ksp_theme", THEME); } catch (e) {}
  }
  function showInitialHeat() {
    if (!mapObj || !L.heatLayer) return;
    const pts = DB.cases.map((c) => [c.lat, c.lng, 0.45]);
    heatLayer = L.heatLayer(pts, { radius: 18, blur: 22, maxZoom: 12, gradient: heatGradient() }).addTo(mapObj);
  }
  function applyMap(r) {
    if (!mapObj) return;
    markerGroup.clearLayers();
    if (heatLayer) { mapObj.removeLayer(heatLayer); heatLayer = null; }
    if (predMarker) { mapObj.removeLayer(predMarker); predMarker = null; }
    const cases = r.cases || [];
    if (cases.length && L.heatLayer) {
      heatLayer = L.heatLayer(cases.map((c) => [c.lat, c.lng, 0.35 + c.severity / 14]),
        { radius: 26, blur: 26, maxZoom: 13, gradient: heatGradient() }).addTo(mapObj);
    } else { showInitialHeat(); }

    (r.hotspots || []).forEach((h, i) => {
      const icon = L.divIcon({ className: "",
        html: `<div class="hot-marker ${i === 0 ? "hot-top" : ""}"><span class="hot-dot"></span><span class="hot-pill">${h.area}<b>${h.count}</b></span></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8] });
      L.marker([h.lat, h.lng], { icon, riseOnHover: true }).bindPopup(hotspotPopup(h)).addTo(markerGroup);
    });

    if (r.prediction) {
      const p = r.prediction;
      predMarker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: "", html: '<div class="pred-pulse">🎯</div>', iconSize: [30, 30], iconAnchor: [15, 15] })
      }).addTo(mapObj);
      predMarker.bindPopup(`<b>🔮 Predicted next hotspot</b><br>${p.area}, ${p.predDistrict}<br>Confidence ${p.confidence}%`);
    }

    const allPts = [...cases.map((c) => [c.lat, c.lng]), ...(r.prediction ? [[r.prediction.lat, r.prediction.lng]] : [])];
    if (allPts.length) { try { mapObj.fitBounds(allPts, { padding: [40, 40], maxZoom: 12 }); } catch (e) {} }
  }
  function injectPredCss() {
    if ($("#predcss")) return;
    const s = el("style"); s.id = "predcss";
    s.textContent = ".pred-pulse{font-size:22px;filter:drop-shadow(0 0 6px #ff5a5f);animation:predpulse 1.2s infinite}@keyframes predpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}";
    document.head.appendChild(s);
  }
  function hotspotPopup(h) {
    const cs = (h.ids || []).map((id) => DB.caseById(id)).filter(Boolean);
    const tc = {}; cs.forEach((c) => (tc[c.type] = (tc[c.type] || 0) + 1));
    const topType = Object.keys(tc).sort((a, b) => tc[b] - tc[a])[0] || "—";
    const recent = cs.slice().sort((a, b) => b.ts - a.ts)[0];
    return `<div class="pop"><div class="pop-h">📍 ${h.area}, ${h.district}</div>` +
      `<div class="pop-row"><span>Cases</span><b>${h.count}</b></div>` +
      `<div class="pop-row"><span>Share of results</span><b>${h.share}%</b></div>` +
      `<div class="pop-row"><span>Top crime</span><b>${topType}</b></div>` +
      (recent ? `<div class="pop-row"><span>Latest</span><b>${recent.type} · ${recent.date}</b></div><div class="pop-id">${recent.id}</div>` : "") +
      `</div>`;
  }

  /* ---- Network ---- */
  function applyNetwork(r) {
    if (!r.network) return;
    renderNetwork(r.network);
    const connected = (r.network.nodes.length - 1) + (r.network.evidence ? r.network.evidence.length : 0);
    $("#netSub").textContent = r.network.focusName + " · " + connected + " links";
  }
  function renderNetwork(net) {
    if (typeof vis === "undefined" || !net) { $("#network").innerHTML = '<div class="placeholder">Graph library offline.</div>'; return; }
    const nodes = [];
    net.nodes.forEach((n) => {
      const isRoot = n.id === net.focusId;
      nodes.push({
        id: n.id, label: (n.alias && ROLES[ROLE].pii ? maskName(n.name) + "\n“" + n.alias + "”" : maskName(n.name)),
        shape: "dot", size: isRoot ? 30 : 18,
        color: { background: riskColor(n.risk), border: isRoot ? "#e0b64a" : "#0a1020", highlight: { background: riskColor(n.risk), border: "#fff" } },
        borderWidth: isRoot ? 4 : 2, font: { color: themeText(), size: isRoot ? 15 : 12, face: "Inter" },
        title: "Risk " + n.risk + "/100"
      });
    });
    (net.evidence || []).forEach((e) => {
      const col = e.kind === "phone" ? "#34d7e6" : e.kind === "vehicle" ? "#4f8cff"
        : e.kind === "account" ? "#3ddc84" : e.kind === "mule" ? "#ff5a5f" : "#8a98b8";
      nodes.push({ id: e.id, label: e.name, shape: "box", color: { background: "#101a2e", border: col }, font: { color: col, size: 11 }, borderWidth: e.kind === "mule" ? 2 : 1, shapeProperties: { borderDashes: [4, 3] } });
    });
    const EDGE = {
      associate: { c: "#2c4068", w: 2, dash: false },
      owns:      { c: "#3ddc84", w: 1, dash: false },
      "txn-flag":{ c: "#ff5a5f", w: 3, dash: [6, 4] },
      txn:       { c: "#4f8cff", w: 1, dash: [4, 4] }
    };
    const edges = net.edges.map((ed) => {
      const st = EDGE[ed.kind] || { c: "#1f2d49", w: 1, dash: [4, 3] };
      return {
        from: ed.from, to: ed.to,
        color: { color: st.c, highlight: "#e0b64a" }, dashes: st.dash, width: st.w,
        arrows: (ed.kind === "txn" || ed.kind === "txn-flag") ? "to" : undefined,
        font: { color: "#8a98b8", size: 9, strokeWidth: 0, background: "rgba(7,11,22,.6)" }, label: ed.label, smooth: { type: "continuous" }
      };
    });
    const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    const options = {
      physics: { stabilization: { iterations: 150, fit: true }, barnesHut: { gravitationalConstant: -9000, springLength: 110, springConstant: 0.04 } },
      interaction: { hover: true, tooltipDelay: 120 }, layout: { improvedLayout: true }
    };
    if (netObj) netObj.destroy();
    netObj = new vis.Network($("#network"), data, options);
    const fitNet = () => { try { netObj.fit({ animation: false }); } catch (e) {} };
    netObj.once("stabilizationIterationsDone", () => { netObj.setOptions({ physics: false }); fitNet(); });
    netObj.on("afterDrawing", function once() { netObj.off("afterDrawing", once); fitNet(); });
    setTimeout(fitNet, 500); // fallback so the graph always centres in the panel
    netObj.on("click", (params) => {
      if (!params.nodes.length) return;
      const id = params.nodes[0];
      if (/^SUS/.test(id)) { const s = DB.suspectById(id); audit("expand.network", s.name); renderNetwork(Engine.buildNetwork(id, 2)); $("#netSub").textContent = s.name + " · risk " + s.riskScore; applyForecast({ risk: { subject: s.name + " (" + s.id + ")", score: s.riskScore, factors: s.riskFactors } }); }
    });
  }
  function riskColor(v) { return v >= 70 ? "#ff5a5f" : v >= 40 ? "#ffb020" : "#3ddc84"; }

  /* ---- Forecast & Risk (Explainable AI) ---- */
  function applyForecast(r) {
    const box = $("#forecast");
    if (!r.prediction && !r.risk && !r.financial) return;
    let html = "";
    if (r.financial) {
      const f = r.financial;
      const flagged = f.transactions.filter((t) => t.flagged).reduce((x, t) => x + t.amount, 0);
      html += `<div class="pred-card" style="background:linear-gradient(145deg,rgba(255,90,95,.10),rgba(255,176,32,.05));border-color:rgba(255,90,95,.3)">
        <div class="pc-top"><div><div class="pc-area" style="color:#ff7a7f">💸 Money Trail</div>
        <div class="pc-meta">${f.accounts.length} accounts · ${f.transactions.length} transfers · ${f.mules} suspected mule a/c</div></div>
        <div class="conf-ring" style="background:#ff5a5f;color:#fff">₹${Math.round(flagged / 1000)}k</div></div></div>`;
    }
    if (r.prediction) {
      const p = r.prediction;
      html += `<div class="pred-card"><div class="pc-top">
          <div><div class="pc-area">📍 ${p.area}</div><div class="pc-meta">${p.predDistrict} · next ${p.type} hotspot</div></div>
          <div class="conf-ring">${p.confidence}%</div></div></div>`;
      html += factorBars(p.factors, "#34d7e6");
    }
    if (r.risk) {
      const cls = r.risk.score >= 70 ? "risk-high" : r.risk.score >= 40 ? "risk-mid" : "risk-low";
      html += `<div class="risk-meter"><canvas id="riskGauge" width="150" height="150" style="max-width:150px;margin:auto"></canvas>
               <div class="rm-score ${cls}">${r.risk.score}<span style="font-size:16px">/100</span></div>
               <div class="rm-sub">${escapeHtml(r.risk.subject)}</div></div>`;
      html += factorBars(r.risk.factors, "#ffb020");
    }
    html += `<div class="xai-note">ⓘ ${LANG === "kn" ? "ಪ್ರತಿ ಅಂಶವೂ ದಾಖಲೆಗಳಿಂದ ಲೆಕ್ಕ — ಯಾವುದೇ ಬ್ಲಾಕ್‌ಬಾಕ್ಸ್ ಇಲ್ಲ." : "Every factor is computed from records — no black box. Officer makes the final decision."}</div>`;
    box.innerHTML = html;
    if (r.risk && typeof Chart !== "undefined") drawGauge(r.risk.score);
  }
  function factorBars(factors, color) {
    const max = Math.max.apply(null, factors.map((f) => f.value)) || 1;
    return factors.map((f) =>
      `<div class="factor"><div class="f-top"><span class="f-lbl">${f.label}</span><span class="f-det">${f.detail}</span></div>
       <div class="bar"><i style="width:${Math.max(6, (f.value / max) * 100)}%;background:linear-gradient(90deg,${color},#4f8cff)"></i></div></div>`
    ).join("");
  }
  let gaugeChart;
  function drawGauge(score) {
    const ctx = $("#riskGauge"); if (!ctx) return;
    if (gaugeChart) gaugeChart.destroy();
    const col = score >= 70 ? "#ff5a5f" : score >= 40 ? "#ffb020" : "#3ddc84";
    gaugeChart = new Chart(ctx, {
      type: "doughnut",
      data: { datasets: [{ data: [score, 100 - score], backgroundColor: [col, trackCol()], borderWidth: 0, circumference: 270, rotation: 225 }] },
      options: { cutout: "75%", plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { animateRotate: true } }
    });
  }

  /* ---- Sociological insights (pillar #4) ---- */
  let ageChart;
  function applySocio(r) {
    const panel = $("#socioPanel"), box = $("#socio");
    if (!r.socio) { panel.style.display = "none"; return; }
    panel.style.display = "";
    const s = r.socio, dem = s.demo;
    const corr = s.correlations.map((c) => {
      const col = c.r >= 0 ? "#ff5a5f" : "#3ddc84";
      return `<div class="factor"><div class="f-top"><span class="f-lbl">${c.name}</span><span class="f-det">r=${c.r} · ${c.strength}</span></div>
        <div class="bar"><i style="width:${Math.max(6, Math.abs(c.r) * 100)}%;background:${col}"></i></div>
        <div class="corr-insight">${c.insight}</div></div>`;
    }).join("");
    box.innerHTML = `
      <div class="socio-grid">
        <div class="socio-col">
          <div class="socio-h">Crime ↔ social-factor correlation <span>(across 12 districts)</span></div>
          ${corr}
        </div>
        <div class="socio-col">
          <div class="socio-h">Offender demographic — ${s.crimeType}</div>
          <canvas id="ageChart" height="140"></canvas>
          <div class="demo-line">👥 ${dem.total} offenders · ♂ ${Math.round(dem.male / (dem.total || 1) * 100)}% · ♀ ${Math.round(dem.female / (dem.total || 1) * 100)}%</div>
          <div class="socio-h" style="margin-top:12px">Worst-affected districts</div>
          <table class="cases mini"><thead><tr><th>District</th><th>Cases</th><th>Unemp%</th><th>Lit%</th><th>Urban%</th></tr></thead>
          <tbody>${s.districtTable.slice(0, 6).map((d) => `<tr><td>${d.district}</td><td class="cid">${d.count}</td><td>${d.unemployment}</td><td>${d.literacy}</td><td>${d.urban}</td></tr>`).join("")}</tbody></table>
        </div>
      </div>
      <div class="xai-note">ⓘ Correlation ≠ causation — these are prevention-planning signals, grounded in ${s.cases.length} records.</div>`;
    if (typeof Chart !== "undefined") {
      const ctx = $("#ageChart"); if (ageChart) ageChart.destroy();
      ageChart = new Chart(ctx, {
        type: "bar",
        data: { labels: Object.keys(dem.ageBuckets), datasets: [{ data: Object.values(dem.ageBuckets), backgroundColor: ["#4f8cff", "#34d7e6", "#ffb020", "#ff5a5f"], borderRadius: 5 }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: themeMuted() }, grid: { display: false } }, y: { ticks: { color: themeMuted() }, grid: { color: gridCol() } } } }
      });
    }
  }

  /* ---- Timeline ---- */
  function applyTimeline(r) {
    const box = $("#timeline"); const tl = r.timeline || [];
    if (!tl.length) { box.innerHTML = `<div class="placeholder">${T().ph_timeline}</div>`; return; }
    $("#tlSub").textContent = tl.length + " events";
    let html = "";
    if (r.escalation) {
      const lbl = { escalating: "⚠ Escalating severity pattern", "de-escalating": "↓ De-escalating pattern", steady: "→ Steady pattern" }[r.escalation];
      html += `<span class="tl-flag tl-${r.escalation}">${lbl}</span>`;
    }
    html += tl.slice(-14).map((t) =>
      `<div class="tl-item"><span class="tl-date">${t.date}</span>
        <span class="tl-main"><b>${t.type}</b> · ${t.area}, ${t.district}
        <span class="sev-dot" style="background:${riskColor(t.severity * 10)}"></span>
        <div class="tl-id">${t.id}</div></span></div>`
    ).join("");
    box.innerHTML = html;
  }

  /* ---- Evidence table ---- */
  function applyEvidence(r) {
    const box = $("#evidence"); const cases = r.cases || [];
    if (!cases.length) { box.innerHTML = `<div class="placeholder">${T().ph_evidence}</div>`; return; }
    const rows = cases.slice(0, 40).map((c) => {
      const pc = c.status === "Closed" || c.status === "Charge-sheeted" ? "closed" : c.status.startsWith("Open") ? "open" : "inv";
      return `<tr><td class="cid">${c.id}</td><td>${c.type}</td><td>${c.date}</td><td>${c.area}, ${c.district}</td>
        <td><span class="pill ${pc}">${c.status}</span></td></tr>`;
    }).join("");
    box.innerHTML = `<table class="cases"><thead><tr><th>Case ID</th><th>Type</th><th>Date</th><th>Location</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function enableReport(r) {
    const btn = $("#reportBtn");
    btn.disabled = !(r.cases && r.cases.length);
    btn.onclick = () => generateReport(lastResult);
  }

  /* ----------------------------- PDF report ------------------------------- */
  function generateReport(r) {
    if (!r || typeof window.jspdf === "undefined") { alert("PDF library offline."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const now = new Date();
    audit("report.generate", r.intent);

    // Header band
    doc.setFillColor(12, 19, 34); doc.rect(0, 0, W, 78, "F");
    doc.setFillColor(224, 182, 74); doc.rect(0, 78, W, 3, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text("KARNATAKA STATE POLICE", 40, 34);
    doc.setFontSize(11); doc.setTextColor(224, 182, 74);
    doc.text("Crime Intelligence Copilot — Investigation Report", 40, 52);
    doc.setFontSize(8); doc.setTextColor(180);
    doc.text("RESTRICTED · DEMO (synthetic data)", W - 40, 30, { align: "right" });
    doc.text(now.toLocaleString(), W - 40, 44, { align: "right" });

    let y = 104;
    const heading = (t) => { doc.setTextColor(20, 40, 80); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(t, 40, y); y += 6; doc.setDrawColor(224, 182, 74); doc.line(40, y, W - 40, y); y += 14; };
    const para = (t) => { doc.setTextColor(40); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); const lines = doc.splitTextToSize(t, W - 80); doc.text(lines, 40, y); y += lines.length * 13 + 8; };

    heading("1 · Query & Method");
    para('Officer query: "' + r.query + '"');
    para("Intent: " + r.intent + ".  Method: grounded retrieval over the KSP crime database. Every figure below is computed directly from " + (r.sources ? r.sources.length : 0) + " cited case record(s) — zero generative invention.");

    heading("2 · Executive Summary");
    para(r.answerEN);

    if (r.prediction) {
      heading("3 · Predictive Forecast (Explainable)");
      para("Predicted next " + r.prediction.type + " hotspot: " + r.prediction.area + ", " + r.prediction.predDistrict + " — confidence " + r.prediction.confidence + "%.");
      doc.autoTable({ startY: y, head: [["Factor", "Detail"]], body: r.prediction.factors.map((f) => [f.label, f.detail]),
        theme: "grid", headStyles: { fillColor: [16, 26, 46] }, styles: { fontSize: 8.5, cellPadding: 4 }, margin: { left: 40, right: 40 } });
      y = doc.lastAutoTable.finalY + 16;
    }

    if (r.risk) {
      heading((r.prediction ? "4" : "3") + " · Risk Dossier (Explainable)");
      para(r.risk.subject + " — risk score " + r.risk.score + "/100.");
      doc.autoTable({ startY: y, head: [["Factor", "Contribution", "Detail"]], body: r.risk.factors.map((f) => [f.label, Math.round(f.value), f.detail]),
        theme: "grid", headStyles: { fillColor: [16, 26, 46] }, styles: { fontSize: 8.5, cellPadding: 4 }, margin: { left: 40, right: 40 } });
      y = doc.lastAutoTable.finalY + 16;
    }

    if (r.hotspots && r.hotspots.length) {
      if (y > 680) { doc.addPage(); y = 50; }
      heading("Hotspot Clusters");
      doc.autoTable({ startY: y, head: [["Location", "District", "Cases", "Share"]], body: r.hotspots.map((h) => [h.area, h.district, h.count, h.share + "%"]),
        theme: "striped", headStyles: { fillColor: [16, 26, 46] }, styles: { fontSize: 8.5, cellPadding: 4 }, margin: { left: 40, right: 40 } });
      y = doc.lastAutoTable.finalY + 16;
    }

    if (r.cases && r.cases.length) {
      if (y > 640) { doc.addPage(); y = 50; }
      heading("Cited Case Records");
      doc.autoTable({ startY: y, head: [["Case ID", "Type", "Date", "Location", "Status"]],
        body: r.cases.slice(0, 28).map((c) => [c.id, c.type, c.date, c.area + ", " + c.district, c.status]),
        theme: "grid", headStyles: { fillColor: [16, 26, 46] }, styles: { fontSize: 8, cellPadding: 3 }, margin: { left: 40, right: 40 } });
      y = doc.lastAutoTable.finalY + 10;
    }

    // Footer on every page
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5); doc.setTextColor(140);
      doc.text("Generated by KSP Crime Intelligence Copilot · Datathon 2026 · synthetic demo data", 40, doc.internal.pageSize.getHeight() - 22);
      doc.text("Page " + i + " / " + pages, W - 40, doc.internal.pageSize.getHeight() - 22, { align: "right" });
    }
    doc.save("KSP-Investigation-Report-" + now.toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".pdf");
  }

  /* ------------------------------- Voice ---------------------------------- */
  let recog, listening = false;
  function initVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR(); r.continuous = false; r.interimResults = false;
    r.onresult = (e) => { const t = e.results[0][0].transcript; $("#queryInput").value = t; stopListen(); ask(t, { fromVoice: true }); };
    r.onerror = () => stopListen();
    r.onend = () => stopListen();
    return r;
  }
  function toggleListen() {
    recog = recog || initVoice();
    if (!recog) { $("#speakStatus").textContent = T().noVoice; return; }
    if (listening) { recog.stop(); stopListen(); return; }
    recog.lang = LANG === "kn" ? "kn-IN" : "en-IN";
    try { recog.start(); listening = true; $("#micBtn").classList.add("listening"); $("#speakStatus").textContent = T().listening; }
    catch (e) { stopListen(); }
  }
  function stopListen() { listening = false; $("#micBtn").classList.remove("listening"); $("#speakStatus").textContent = ""; }
  function speak(text) {
    if (!("speechSynthesis" in window) || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.slice(0, 260));
      u.lang = LANG === "kn" ? "kn-IN" : "en-IN"; u.rate = 1.02;
      const v = speechSynthesis.getVoices().find((x) => x.lang === u.lang);
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ------------------------------- Audit ---------------------------------- */
  // Persisted to localStorage → demonstrates the traceability a real
  // deployment needs (production: write-once Catalyst Data Store + Signals).
  const auditLog = [];
  function audit(action, detail) {
    auditLog.unshift({ t: new Date().toLocaleTimeString("en-GB"), action, detail, role: ROLE });
    saveAudit(); renderAudit();
  }
  function renderAudit() {
    $("#auditTrack").innerHTML = auditLog.slice(0, 12).map((a) =>
      `<span class="ae"><b>${a.t}</b> ${a.action}${a.detail ? " · " + escapeHtml(a.detail) : ""} <em>[${a.role || ROLE}]</em></span>`
    ).join("");
  }
  function saveAudit() { try { localStorage.setItem("ksp_audit", JSON.stringify(auditLog.slice(0, 100))); } catch (e) {} }
  function loadAudit() { try { const a = JSON.parse(localStorage.getItem("ksp_audit") || "[]"); if (a.length) auditLog.push(...a); } catch (e) {} }

  /* ------------------------------- Events --------------------------------- */
  function bindEvents() {
    $("#sendBtn").onclick = () => ask();
    $("#queryInput").addEventListener("keydown", (e) => { if (e.key === "Enter") ask(); });
    $("#micBtn").onclick = toggleListen;
    $("#suggToggle").onclick = () => {
      const collapsed = $("#suggestions").classList.toggle("collapsed");
      $("#suggToggle").textContent = collapsed ? "▸" : "▾";
    };
    $("#themeToggle").onclick = () => { THEME = THEME === "light" ? "dark" : "light"; applyTheme(); audit("theme.switch", THEME); };
    $("#roleBadge").onclick = () => {
      const keys = Object.keys(ROLES);
      ROLE = keys[(keys.indexOf(ROLE) + 1) % keys.length];
      $("#roleText").textContent = ROLE;
      $("#roleBadge").title = ROLES[ROLE].scope;
      $("#speakStatus").textContent = "🔐 Role: " + ROLE + " — " + ROLES[ROLE].scope;
      audit("role.switch", ROLE);
      if (lastResult) applyPanels(lastResult);
    };
    $("#langToggle").querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        LANG = b.dataset.lang;
        $("#langToggle").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
        applyLang(); renderSuggestions();
        audit("lang.switch", LANG);
      };
    });
  }

  /* -------------------------------- Go ------------------------------------ */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
