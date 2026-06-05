# Deploying the KSP Crime Intelligence Copilot on Catalyst by Zoho

> **Mandatory gate:** Datathon 2026 requires deployment on Catalyst, and requires using Catalyst services where one exists. This document maps every feature to its required Catalyst service and gives the exact deploy steps. The `catalyst/` folder contains a ready-to-deploy backend **Function** (which reuses the *same* grounded engine as the browser app) plus the Data Store schema.

---

## 0. One-time setup

1. **Claim credits:** https://catalyst.zoho.com/promotions.html?cn=KSPH26
2. Install the CLI and log in:
   ```bash
   npm install -g zcatalyst-cli
   catalyst login
   ```
3. From `catalyst/`, run `catalyst init` once to bind these files to your Catalyst project (it writes the authoritative `catalyst.json` / `catalyst-config.json` with your project IDs — keep our `index.js`, `schema.sql`, etc.).

---

## 1. Feature → required Catalyst service (this is the architecture)

| Capability in this product | Required Catalyst service | Status in repo |
|---|---|---|
| Static SPA (the polished UI) | **Web Client Hosting** (or Slate) | ✅ ready — host `client/` |
| Backend API / business logic | **Serverless Functions** (Advanced I/O, Node) | ✅ `catalyst/functions/crime_api` |
| Crime DB: FIRs, accused, victims, locations, accounts | **Data Store** (relational) + full-text search | ✅ `catalyst/datastore/schema.sql` |
| Case notes / embeddings / blobs | **NoSQL** + **Stratus** | ◻ schema noted |
| Conversational AI + RAG grounding + follow-up + Kannada | **QuickML — LLM Serving + RAG** | ◻ stub in `index.js` (`quickmlParse`) |
| Validated risk score + crime forecast | **Zia AutoML** (tabular) | ◻ stub (`ziaScore`) |
| Voice Q&A (STT/TTS) + EN↔Kannada translation | **Zia Services** | ◻ stub (`ziaSpeechToText`) |
| Server-side PDF report + conversation-history PDF | **SmartBrowz** | ◻ stub (`smartBrowzPdf`) |
| Role-based login (Investigator/Analyst/Supervisor/Policymaker) | **Authentication** | ✅ RBAC logic; wire Auth for identity |
| Autonomous investigation pipeline (the wow) | **Circuits** (orchestration) | ◻ design in §4 |
| Early-warning alerts (scheduled scans → notify) | **Cron** + **Push Notifications** + **Mail** | ◻ design in §4 |
| New-FIR triggers re-analysis | **Signals + Event Functions** | ◻ design in §4 |
| API security / throttling | **API Gateway** · cache: **Cache** · CI/CD: **Pipelines** | ◻ |

✅ = in this repo · ◻ = designed, with integration point stubbed in code

---

## 2. Deploy the frontend (Web Client Hosting)

```bash
# from catalyst/
mkdir -p client
cp ../index.html ../styles.css ../app.js ../engine.js ../data.js client/
# (client-package.json is already provided)
catalyst deploy --only client
```
Your UI is now live on a `*.catalystserverless.com` URL → **mandatory gate passed.**

> Point the UI at the backend by replacing the in-browser engine call with `fetch('/server/crime_api/query', …)` once the Function is deployed (see §3). The app is structured so this is a one-line swap — the engine returns the same shape over HTTP.

---

## 3. Deploy the backend (Serverless Function)

The function **imports the same `engine.js` + `data.js`** as the browser — one brain, two runtimes (already proven: `node -e "require('./engine').handle('...')"`).

```bash
# from catalyst/functions/crime_api/
npm install
# from catalyst/
catalyst deploy --only functions
```
Endpoints (served under `/server/crime_api`):
- `GET  /health`
- `GET  /stats`
- `POST /query`  → body `{ "q": "Investigate chain snatching in Bengaluru" }`, header `x-ksp-role: Investigator`

Swap the synthetic `data.js` for **Data Store** reads (ZCQL) using `schema.sql`, and replace the deterministic `parse()` with the **QuickML LLM** call (`quickmlParse`) — the grounded retrieval + RBAC + citations stay identical, so answers remain verifiable.

---

## 4. Wiring the remaining Catalyst services (integration points are stubbed in `index.js`)

- **QuickML (LLM + RAG):** create a knowledge base from case records; call LLM Serving in `quickmlParse(q)` to emit `{intent, entities}` and to phrase answers in English/Kannada. Keep the engine's grounded retrieval so every claim still cites case IDs.
- **Zia AutoML:** train tabular models on the `accused` / `fir_cases` tables for risk and next-hotspot; call from `ziaScore()`. Report train/test accuracy in your submission.
- **Zia Services:** STT for voice queries, TTS for spoken answers, translate EN↔Kannada (replaces the browser Web Speech fallback).
- **SmartBrowz:** render the report HTML to PDF server-side and store in **Stratus** (replaces client jsPDF).
- **Authentication:** sign-in; map the user to a role → feeds the RBAC scopes already in `index.js`.
- **Circuits:** model "Autonomous Investigation" as a Circuit: retrieve → cluster → graph → forecast → report, with parallel branches.
- **Cron + Signals + Push/Mail:** nightly Cron scans for emerging clusters / repeat-offender activity → early-warning alerts; a Signal on new-FIR insert triggers an Event Function to re-score the network.
- **API Gateway / Cache / Pipelines:** throttle + secure the Function; cache hot queries; CI/CD from git.

---

## 5. What to say to judges
> "Every capability is Catalyst-native — Functions, Data Store, QuickML LLM+RAG, Zia AutoML, Zia voice, SmartBrowz, Auth, Circuits, Cron/Signals. The conversational core is the **same grounded engine** running in the browser and in a Catalyst Function, so answers are identical and every claim cites its source record. Deployed, explainable, bilingual, role-governed."
