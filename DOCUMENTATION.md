# 🛡️ KSP Crime Intelligence Copilot — Full Documentation

**Datathon 2026 · Challenge 01 — Intelligent Conversational AI for KSP Crime Database**

An agentic *Investigation Copilot*: ask one question and the system retrieves cases, builds the criminal network, maps hotspots, runs explainable forecasts/risk, analyses money-trails and sociological drivers, and generates a report — **grounded in records with citations (zero hallucination)**, in **English + ಕನ್ನಡ**, with **voice**, **role-based access**, and a **light/dark** UI.

> ⚠️ All data is **100% synthetic & fictional** (generated in `data.js`). No real persons, cases, phones, vehicles, or accounts.

---

## 1. Quick start

```bash
cd ~/Desktop/Datathon
./start.sh            # then it opens http://localhost:8000 automatically
```
- macOS users can also **double-click `start.command`** in Finder.
- Or manually: `python3 serve.py` (or `python3 -m http.server 8000`) then open `http://localhost:8000`.
- Always use **`localhost`** (not the `file://` path) so the microphone/voice works.
- No build step, no API keys — it runs entirely in the browser on synthetic data, so it can't break on stage.

---

## 2. Interface tour

### 2.1 Overview (command centre)
![Overview — dark](docs/screenshots/01-overview-dark.png)
*Top bar: KSP branding, a clickable **role badge** (RBAC), a **theme toggle** (☀️/🌙), an **EN/ಕನ್ನಡ** switch, and a live clock. Below it, four live KPI cards (total cases, known suspects, districts, open/under-investigation). Left = the Copilot; right = the analysis workspace (map, network, forecast).*

### 2.2 Conversational Copilot + Autonomous Investigation ⭐
![Copilot autonomous reasoning](docs/screenshots/02-copilot-autonomous-dark.png)
*Type a question (or use the suggestion chips / mic). For **"Investigate …"** the copilot runs the whole pipeline itself and shows its **reasoning step-by-step** (parse → retrieve → cluster → graph → forecast → report). Every answer ends with **Sources: KSP-xxxxx** citations — the heart of the zero-hallucination design. It also keeps **conversation context**, so "predict the next one" or "show their network" work without repeating yourself.*

### 2.3 Crime Hotspot Map (geospatial)
![Crime map — dark](docs/screenshots/03-map-dark.png)
*A live Leaflet heatmap + cluster markers across Karnataka. Gold circles are hotspot clusters (sized by case count); the pulsing 🎯 marks the **predicted** next hotspot. The map auto-zooms to the current results.*

### 2.4 Criminal Network (link analysis)
![Criminal network — dark](docs/screenshots/04-network-dark.png)
*An interactive graph of suspects ↔ associates ↔ phones ↔ vehicles ↔ cases. Node colour = risk (green→amber→red). **Click any suspect** to expand their network and load their dossier.*

### 2.5 Forecast & Risk — Explainable AI
![Forecast and risk — dark](docs/screenshots/05-forecast-dark.png)
*Never a black box. The forecast shows the predicted area + confidence **with the factors behind it** (recent incidents, historical frequency, active offenders, recency momentum). The risk gauge shows a suspect's score with a transparent factor breakdown. The footnote reminds: the officer makes the final decision.*

### 2.6 Investigation Timeline (pattern detection)
![Timeline — dark](docs/screenshots/06-timeline-dark.png)
*Cases plotted chronologically with a **pattern flag** — escalating / steady / de-escalating severity — to surface behavioural trends.*

### 2.7 Evidence & PDF Report
![Evidence table — dark](docs/screenshots/07-evidence-dark.png)
*The cited case records (ID, type, date, location, status). **Generate PDF Report** produces a formatted KSP investigation report with the summary, forecast, risk, hotspots and a cited case table.*

### 2.8 Financial Crime — money trail
![Money trail — dark](docs/screenshots/08-financial-dark.png)
*"Show the money trail" reveals the suspect's accounts and **transaction flow through layered mule accounts** (red = flagged transfers, with arrows and ₹ amounts) — classic laundering structure — plus the flagged total.*

### 2.9 Sociological Insights (criminology)
![Sociological insights — dark](docs/screenshots/09-socio-dark.png)
*Correlates crime with **socio-economic factors** (unemployment, literacy, urbanization, migration, income) across all 12 districts using Pearson correlation, plus an **offender demographic** breakdown (age bands, gender) and the worst-affected districts — decision support for prevention planning.*

### 2.10 Light theme
![Overview — light](docs/screenshots/10-overview-light.png)
![Map — light](docs/screenshots/11-map-light.png)
![Network — light](docs/screenshots/12-network-light.png)
*One click on ☀️/🌙 switches the entire UI — including **map tiles** (dark → light) and **graph/chart** colours — and the choice is remembered across sessions.*

---

## 3. How it works — function by function

The app is three small, dependency-light files plus the UI shell. `data.js` and `engine.js` are **isomorphic** — the same code runs in the browser *and* in a Node/Catalyst Function.

### `data.js` — the synthetic crime database + transparent risk model
| Function | What it does |
|---|---|
| `mulberry32(seed)` | Seeded RNG → the dataset is identical on every load (reproducible demos). |
| `weightedCrime()` / `weightedDistrict()` | Pick crime types & districts by realistic weights (Bengaluru dominates). |
| *(generation)* | Builds **suspects → cases → associates → victims → accounts → transactions**, plus per-district **socio-economic** indicators. |
| `scoreSuspect(s)` | Transparent risk score from 4 named factors (case volume, recent activity, severity, network reach) — **no black box**. |
| `DB.caseById / suspectById / victimById / accountById / txForAccount` | Fast lookups used everywhere. |
| `DB.sampleHotPhone() / topSuspect() / stats()` | Power the demo chips and KPI cards. |

### `engine.js` — the agent brain (NLU + grounded retrieval)
| Function | What it does |
|---|---|
| `parse(q)` | Extracts **intent + entities** (crime type, district/area, time window, phone, vehicle, suspect, case id) via keyword/regex NLU. *(Production: swap for a Catalyst QuickML LLM that emits the same shape.)* |
| `handleInner(q)` | Resolves **follow-up context** (fills gaps from memory) then dispatches to the right handler. |
| `handle(q)` | Public entry — runs `handleInner` then **updates conversation memory** (last crime/district/suspect/case). |
| `filterCases(e)` | Grounded retrieval over records for the parsed entities. |
| `computeHotspots(cases)` | Clusters cases by area → counts + share (map + report). |
| `buildNetwork(id, depth)` | Builds the suspect graph (associates, phones, vehicles, cases). |
| `predictHotspot(type, district)` | **Recency-weighted** forecast (exponential time-decay) → next area + confidence + factors. |
| `moneyTrail(s)` | Follows flagged transactions outward → accounts, mules, and a vis-ready money-flow graph (pillar #7). |
| `socioInsights(type)` | **Pearson correlation** of crime vs socio-economic factors + offender demographics (pillar #4). |
| `similarCases(ref, n)` | Ranks comparable cases by modus operandi, type, location, severity (pillar #6). |
| `timeline()` / `escalation()` | Chronology + escalating/steady/de-escalating pattern. |

Every handler returns the **same result shape** (answer EN/KN, cases, network, prediction, risk, financial, socio, timeline, **sources**) so the UI renders uniformly and citations are always present.

### `app.js` — UI orchestration
| Area | Functions | What they do |
|---|---|---|
| Boot | `boot`, `renderStats`, `renderSuggestions`, `startClock` | Initialise theme/role, KPIs, demo chips, clock. |
| Conversation | `ask`, `addUser/addBot/addThink`, `runAutonomous` | Send a query, render messages + citations, animate the autonomous pipeline. |
| Panels | `applyPanels` → `applyMap`, `applyNetwork`, `applyForecast`, `applySocio`, `applyTimeline`, `applyEvidence` | Render each analysis view from the engine result. |
| Map | `initMap`, `swapMapTiles`, `showInitialHeat` | Leaflet map + heat + markers + predicted-hotspot pin. |
| Graph/Charts | `renderNetwork`, `drawGauge`, `factorBars` | vis-network graph + Chart.js risk gauge + explainable bars. |
| Theme | `applyTheme` | Toggle light/dark, swap map tiles, re-render theme-aware colours, persist. |
| Governance | RBAC in `ask`, `maskAnswer`, `audit/renderAudit/saveAudit/loadAudit` | Role gating, PII masking, persistent audit log (pillar #10). |
| Voice | `initVoice`, `toggleListen`, `speak` | Web Speech STT/TTS (en-IN / kn-IN). |
| Report | `generateReport` | Builds the cited PDF investigation report (jsPDF). |

---

## 4. Roles (Role-Based Access Control)
Click the role badge to switch. Each role changes what's permitted:

| Role | Financial money-trail | Suspect names (PII) |
|---|---|---|
| **Investigator** | ✅ allowed | shown |
| **Analyst** | 🚫 blocked | shown |
| **Supervisor** | ✅ allowed | shown |
| **Policymaker** | 🚫 blocked | **masked** ("Subject") |
Every query, role switch, and denied access is written to the **audit log** (bottom bar, persisted).

## 5. Example queries (and follow-ups)
- `Investigate chain snatching in Bengaluru` → autonomous full investigation
- `Show the money trail` · `Sociological insights for vehicle theft`
- `Network for <name>` · `Find similar cases to KSP-10000`
- `Trace phone <number>` · `Predict next chain snatching hotspot in Bengaluru`
- Follow-ups (no need to repeat context): `predict the next one`, `show their network`, `find similar cases`

## 6. Deployment (mandatory: Catalyst by Zoho)
See **[CATALYST.md](CATALYST.md)** — feature→Catalyst-service mapping and step-by-step deploy. The backend Function in `catalyst/functions/crime_api` reuses the **same engine** as this UI (verified serving `/health`, `/stats`, `/query` with RBAC).

## 7. File map
```
index.html · styles.css      UI shell + light/dark theme
data.js                      synthetic DB + risk model        (isomorphic)
engine.js                    NLU + grounded retrieval + analytics (isomorphic)
app.js                       UI orchestration (map/graph/voice/PDF/theme/RBAC)
serve.py · start.sh · start.command   local launch
catalyst/ · CATALYST.md      Catalyst deployment package + guide
docs/screenshots/            the images in this document
README.md                    rubric coverage + demo script
```
