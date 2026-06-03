# 🛡️ KSP Crime Intelligence Copilot

### Agentic Investigation Copilot for the Karnataka State Police — Datathon 2026 (Challenge 01)

> One question. One officer. The whole investigation: search → network → map → **explainable** forecast → auto-generated report. Grounded in records, **zero hallucination**, English + ಕನ್ನಡ, voice-enabled.

This is a **working prototype**, not a slide deck. It runs entirely in the browser on synthetic Karnataka crime data — no API keys, no backend, nothing to fail on stage.

---

## 🚀 Run it (10 seconds)

```bash
cd /Users/rahulsingh/Desktop/Datathon
python3 -m http.server 8000
# open http://localhost:8000
```

> Use `localhost` (not the `file://` double-click) so the **microphone / voice** features work — browsers require a secure origin for the Web Speech API.

No build step. No npm. First load fetches a few CDN libraries (map, graph, charts, PDF). For a guaranteed-offline demo, see *Offline hardening* below.

---

## 🎯 What it does — the 5 modules

| # | Module | What judges see |
|---|--------|-----------------|
| 1 | **Conversational Copilot** | Natural-language + voice queries (EN/ಕನ್ನಡ); every answer cites the exact case IDs it used |
| 2 | **Crime Hotspot Map** | Live Leaflet heatmap + cluster markers across Karnataka, auto-zoom to results |
| 3 | **Criminal Network Graph** | Interactive vis-network of suspects ↔ associates ↔ phones ↔ vehicles ↔ cases. Click any suspect to expand |
| 4 | **Explainable Forecast & Risk** | Recency-weighted next-hotspot prediction + suspect risk score — **with the reasons**, never a black box |
| 5 | **Auto PDF Report** | One click → a formatted KSP investigation report with citations, tables, and forecast |

### ⭐ The headline "wow": Autonomous Investigation
Type **"Investigate chain snatching in Bengaluru"** and the copilot runs the *entire* pipeline itself — you watch it reason step-by-step (retrieve → cluster → graph → forecast → report) and every panel fills in sequence. That's the moment that separates this from "a chatbot."

---

## 🧠 Architecture (prototype → production)

```
          ┌──────────────── BROWSER (this prototype) ────────────────┐
 Officer →│  Copilot UI  ·  Voice (Web Speech)  ·  EN/ಕನ್ನಡ          │
          │        │                                                  │
          │   parse() ──► intent + entities  (LLM in production)      │
          │        │                                                  │
          │   GROUNDED RETRIEVAL ENGINE (engine.js)                   │
          │   ├─ structured filter over records                       │
          │   ├─ geospatial hotspot clustering                        │
          │   ├─ graph builder (suspect network)                      │
          │   ├─ recency-weighted forecast (explainable)              │
          │   └─ transparent risk model (explainable)                 │
          │        │                                                  │
          │   Map · Graph · Charts · Timeline · PDF                   │
          └──────────────────────────────────────────────────────────┘
```

**Why grounded retrieval, not a raw LLM?** For a police product, *trust* beats fluency. The engine computes every number from records and returns the source case IDs, so an officer can verify each claim. In production the only swap is `parse()` → an LLM with function-calling that emits the **same** `{intent, entities}` structure — the verifiable retrieval layer is unchanged. (This is RAG with hard citations.)

### Tech
- **Prototype (here):** Vanilla JS + Leaflet + leaflet.heat + vis-network + Chart.js + jsPDF. Zero build, demo-bulletproof.
- **Production path:** React/TS front-end · Go/Spring microservices · LLM (function-calling) for NLU + Kannada · PostgreSQL/PostGIS + a graph store (Neo4j) + vector index for semantic case search · Whisper STT + Indic TTS · deployed on **Zoho Catalyst** (the Datathon platform) with RBAC, full audit logging, and on-prem/sovereign hosting.

---

## 🏆 Why this wins (mapped to judging)

- **Innovation** — agentic *autonomous investigation*, not a Q&A bot. Multi-modal: language + graph + geo + forecast in one flow.
- **Impact** — collapses a multi-hour manual workflow (search, link analysis, mapping, reporting) into one query. Directly serves KSP investigators.
- **Technical depth** — grounded RAG with citations, graph intelligence, recency-weighted geospatial forecasting, transparent risk scoring.
- **Scalability** — clean separation (UI / NLU / retrieval); swap synthetic DB for CCTNS, swap `parse()` for an LLM. Nothing else changes.
- **Presentation** — government-grade command-centre UI, live voice, bilingual, and a PDF deliverable in hand.

---

## 🎬 5-minute demo script

1. **(0:00) Frame it.** "This is the KSP Crime Intelligence Copilot. Watch one question run an entire investigation." Point to the live stat strip.
2. **(0:30) The wow.** Click **"Investigate chain snatching in Bengaluru."** Narrate the step-by-step reasoning as the map, network, forecast, and timeline fill in.
3. **(1:45) Grounding.** Highlight the **Sources: KSP-xxxxx** citations under the answer — "every claim is verifiable; zero hallucination — essential for policing."
4. **(2:30) Network.** Click a suspect node → the graph expands to associates, phones, vehicles, cases. "This is link analysis in one click."
5. **(3:15) Explainable AI.** Show the forecast + risk **reason bars** — "not a black box; the officer decides."
6. **(4:00) Bilingual + voice.** Toggle **ಕನ್ನಡ**, tap the mic, speak a query, hear the spoken answer.
7. **(4:30) Deliverable.** Click **Generate PDF Report** → open the formatted, cited report. "An officer walks away with this."
8. **(4:50) Close.** "Grounded, explainable, bilingual, deployable on Zoho Catalyst tomorrow. This is CrimeOS."

---

## 🛡️ Ethics & data
All data is **100% synthetic and fictional**, generated deterministically (`data.js`). No real persons, phones, vehicles, or cases. The UI carries a persistent synthetic-data notice and an audit-log strip to model the privacy/accountability posture a real deployment requires.

## 🔧 Offline hardening (optional, for unreliable venue Wi-Fi)
Download the six CDN libraries into a local `vendor/` folder and repoint the `<script>`/`<link>` tags in `index.html`. Then the demo needs **no network at all** except map tiles (which can be swapped for a bundled static Karnataka tile set).

## 🗺️ Roadmap (prototype → production → startup)
- **Prototype (now):** 5 modules + autonomous mode on synthetic data.
- **Pilot:** connect CCTNS/KSP data via governed API; LLM NLU + full Kannada; RBAC + audit; Zoho Catalyst deploy.
- **Production:** semantic case search, CDR/vehicle ingestion, model monitoring, officer feedback loop.
- **CrimeOS (startup):** multi-state, CCTV/face/ANPR integrations, predictive patrolling — an intelligence OS for Indian policing.

---

## 📁 Files
- `index.html` — layout + library includes
- `styles.css` — command-centre theme
- `data.js` — deterministic synthetic crime database + transparent risk model
- `engine.js` — NLU parse + grounded retrieval + forecast + graph (the agent brain)
- `app.js` — UI orchestration, voice, bilingual, map/graph/charts, autonomous mode, PDF
