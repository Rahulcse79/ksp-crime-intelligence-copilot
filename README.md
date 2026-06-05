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

## 🎯 Coverage of the official 10-point problem statement

| # | Required pillar | In this prototype |
|---|---|---|
| 1 | Conversational interface (NL, EN/ಕನ್ನಡ, voice, **context-aware follow-up**, history→PDF) | ✅ chat + voice + follow-up memory + cited answers |
| 2 | Criminal network & relationship analysis | ✅ interactive graph: suspects ↔ associates ↔ phones ↔ vehicles ↔ cases |
| 3 | Crime pattern & trend analytics | ✅ hotspot map + clusters + timeline (seasonal: roadmap) |
| 4 | **Sociological crime insights** | ✅ crime ↔ unemployment/literacy/urbanization/migration correlations + demographics |
| 5 | Criminology offender profiling | ✅ repeat-offender detection + explainable risk score |
| 6 | Investigator decision support | ✅ auto summaries, timelines, **similar-case search**, leads |
| 7 | **Financial crime & transaction links** | ✅ money-trail graph, mule-account detection, flagged totals |
| 8 | Crime forecasting & early warning | ✅ recency-weighted hotspot forecast (alerts via Catalyst Cron: roadmap) |
| 9 | Explainable AI & transparent analytics | ✅✅ every claim cites case IDs; reasoning + factor bars |
| 10 | **Secure role-based access & governance** | ✅ 4 roles, financial gating, PII masking, persistent audit log |

### ⭐ The headline "wow": Autonomous Investigation

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
- `index.html` · `styles.css` — layout + command-centre theme
- `data.js` — synthetic crime DB: FIRs, accused, **victims, accounts, transactions, socio-economic** + transparent risk model *(isomorphic: runs in browser **and** Node)*
- `engine.js` — the agent brain: NLU + grounded retrieval + network + forecast + **financial money-trail + sociological correlations + similar-case + follow-up context** *(isomorphic)*
- `app.js` — UI orchestration, voice, bilingual, map/graph/charts, autonomous mode, RBAC, audit, PDF
- `CATALYST.md` — **mandatory deployment guide**: feature → Catalyst service mapping + exact deploy steps
- `catalyst/` — ready-to-deploy package: `functions/crime_api` (Node Function reusing the engine), `datastore/schema.sql`, `client/`

## 🏛️ Deployment (mandatory: Catalyst by Zoho)
The browser app deploys to **Catalyst Web Client Hosting**; the backend is a **Catalyst Serverless Function** that imports the *same* `engine.js` (verified: `node` runs it headless, and the Function serves `/health`, `/stats`, `/query` with RBAC). Full service mapping (QuickML LLM+RAG, Zia AutoML, Zia voice, SmartBrowz, Auth, Circuits, Cron/Signals) and step-by-step deploy in **[CATALYST.md](CATALYST.md)**.
