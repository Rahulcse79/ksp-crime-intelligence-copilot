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
  let mapObj, heatLayer, markerGroup, predMarker, netObj;
  let lastResult = null;

  /* ------------------------------ i18n ------------------------------------ */
  const STRINGS = {
    en: {
      tagline: "Agentic Investigation Copilot · ಅಪರಾಧ ಗುಪ್ತಚರ ಸಹಾಯಕ",
      role: "Inspector · Crime Branch", copilot: "🤖 Investigation Copilot",
      grounded: "Grounded · 0 hallucination", map: "🗺️ Crime Hotspot Map",
      mapSub: "Live geospatial intelligence", network: "🕸️ Criminal Network",
      netSub: "Click a node to expand", forecast: "🔮 Forecast & Risk", xai: "Explainable AI",
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
    audit("session.start", "role=" + STRINGS.en.role);
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
    const chips = [
      "Investigate chain snatching in Bengaluru",
      "Show vehicle theft in Mysuru last 3 months",
      "Trace phone " + phone,
      "Network for " + sus.name,
      "Predict next chain snatching hotspot in Bengaluru"
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

  /* ------------------- Headline: Autonomous Investigation ----------------- */
  async function runAutonomous(result) {
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
  function applyPanels(r) { applyMap(r); applyNetwork(r); applyForecast(r); applyTimeline(r); applyEvidence(r); }

  /* ---- Map ---- */
  function initMap() {
    if (typeof L === "undefined") { $("#map").innerHTML = '<div class="placeholder">Map library offline.</div>'; return; }
    mapObj = L.map("map", { zoomControl: true, attributionControl: false }).setView([14.6, 76.2], 7);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd"
    }).addTo(mapObj);
    markerGroup = L.layerGroup().addTo(mapObj);
    injectPredCss();
  }
  function showInitialHeat() {
    if (!mapObj || !L.heatLayer) return;
    const pts = DB.cases.map((c) => [c.lat, c.lng, 0.45]);
    heatLayer = L.heatLayer(pts, { radius: 18, blur: 22, maxZoom: 12,
      gradient: { 0.2: "#4f8cff", 0.5: "#34d7e6", 0.75: "#ffb020", 1: "#ff5a5f" } }).addTo(mapObj);
  }
  function applyMap(r) {
    if (!mapObj) return;
    markerGroup.clearLayers();
    if (heatLayer) { mapObj.removeLayer(heatLayer); heatLayer = null; }
    if (predMarker) { mapObj.removeLayer(predMarker); predMarker = null; }
    const cases = r.cases || [];
    if (cases.length && L.heatLayer) {
      heatLayer = L.heatLayer(cases.map((c) => [c.lat, c.lng, 0.35 + c.severity / 14]),
        { radius: 26, blur: 26, maxZoom: 13,
          gradient: { 0.2: "#4f8cff", 0.5: "#34d7e6", 0.75: "#ffb020", 1: "#ff5a5f" } }).addTo(mapObj);
    } else { showInitialHeat(); }

    (r.hotspots || []).forEach((h) => {
      const radius = 9 + Math.min(h.count, 20);
      L.circleMarker([h.lat, h.lng], {
        radius, color: "#e0b64a", weight: 2, fillColor: "#ffb020", fillOpacity: 0.35
      }).bindPopup(`<b>${h.area}</b>, ${h.district}<br>${h.count} case(s) · ${h.share}% of results`).addTo(markerGroup);
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

  /* ---- Network ---- */
  function applyNetwork(r) { if (r.network) { renderNetwork(r.network); $("#netSub").textContent = r.network.focusName + " · " + (r.network.nodes.length - 1) + " links"; } }
  function renderNetwork(net) {
    if (typeof vis === "undefined" || !net) { $("#network").innerHTML = '<div class="placeholder">Graph library offline.</div>'; return; }
    const nodes = [];
    net.nodes.forEach((n) => {
      const isRoot = n.id === net.focusId;
      nodes.push({
        id: n.id, label: (n.alias ? n.name + "\n“" + n.alias + "”" : n.name),
        shape: "dot", size: isRoot ? 30 : 18,
        color: { background: riskColor(n.risk), border: isRoot ? "#e0b64a" : "#0a1020", highlight: { background: riskColor(n.risk), border: "#fff" } },
        borderWidth: isRoot ? 4 : 2, font: { color: "#e8eefc", size: isRoot ? 15 : 12, face: "Inter" },
        title: "Risk " + n.risk + "/100"
      });
    });
    (net.evidence || []).forEach((e) => {
      const col = e.kind === "phone" ? "#34d7e6" : e.kind === "vehicle" ? "#4f8cff" : "#8a98b8";
      nodes.push({ id: e.id, label: e.name, shape: "box", color: { background: "#101a2e", border: col }, font: { color: col, size: 11 }, borderWidth: 1, shapeProperties: { borderDashes: [4, 3] } });
    });
    const edges = net.edges.map((ed) => ({
      from: ed.from, to: ed.to,
      color: { color: ed.kind === "associate" ? "#2c4068" : "#1f2d49", highlight: "#e0b64a" },
      dashes: ed.kind !== "associate", width: ed.kind === "associate" ? 2 : 1,
      font: { color: "#8a98b8", size: 9, strokeWidth: 0, background: "rgba(7,11,22,.6)" }, label: ed.label, smooth: { type: "continuous" }
    }));
    const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    const options = {
      physics: { stabilization: { iterations: 120 }, barnesHut: { gravitationalConstant: -9000, springLength: 110, springConstant: 0.04 } },
      interaction: { hover: true, tooltipDelay: 120 }, layout: { improvedLayout: true }
    };
    if (netObj) netObj.destroy();
    netObj = new vis.Network($("#network"), data, options);
    netObj.once("stabilizationIterationsDone", () => netObj.setOptions({ physics: false }));
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
    if (!r.prediction && !r.risk) return;
    let html = "";
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
      data: { datasets: [{ data: [score, 100 - score], backgroundColor: [col, "#16223b"], borderWidth: 0, circumference: 270, rotation: 225 }] },
      options: { cutout: "75%", plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { animateRotate: true } }
    });
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
  const auditLog = [];
  function audit(action, detail) {
    const t = new Date().toLocaleTimeString("en-GB");
    auditLog.unshift({ t, action, detail });
    const track = $("#auditTrack");
    track.innerHTML = auditLog.slice(0, 10).map((a) =>
      `<span class="ae"><b>${a.t}</b> ${a.action}${a.detail ? " · " + escapeHtml(a.detail) : ""}</span>`
    ).join("");
  }

  /* ------------------------------- Events --------------------------------- */
  function bindEvents() {
    $("#sendBtn").onclick = () => ask();
    $("#queryInput").addEventListener("keydown", (e) => { if (e.key === "Enter") ask(); });
    $("#micBtn").onclick = toggleListen;
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
