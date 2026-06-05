"use strict";
/**
 * KSP Crime Intelligence Copilot — Catalyst Advanced I/O Function (Node.js)
 * ---------------------------------------------------------------------------
 * Reuses the SAME grounded-retrieval engine as the browser app (engine.js +
 * data.js), so server answers are identical to the UI and every claim still
 * cites its source case IDs (zero hallucination).
 *
 * Routes (served by Catalyst under /server/crime_api/...):
 *   GET  /health
 *   GET  /stats
 *   POST /query   body: { "q": "Investigate chain snatching in Bengaluru" }
 *                 header: x-ksp-role: Investigator|Analyst|Supervisor|Policymaker
 *
 * Catalyst services to wire in (see CATALYST.md §4 — integration points below):
 *   QuickML (LLM+RAG) · Zia AutoML · Zia Services (voice) · SmartBrowz (PDF)
 *   · Authentication (role) · Data Store (real FIRs) · Signals/Cron (alerts)
 */
const express = require("express");
const Engine = require("./engine");   // requires ./data automatically
const DB = require("./data");

const app = express();
app.use(express.json());

// RBAC scopes — in production derive the role from Catalyst Authentication.
const ROLE_SCOPES = {
  Investigator: { financial: true,  pii: true  },
  Analyst:      { financial: false, pii: true  },
  Supervisor:   { financial: true,  pii: true  },
  Policymaker:  { financial: false, pii: false }
};
const maskPII = (t) => (t || "").replace(/[A-Z][a-z]+\s[A-Z][a-z]+\s*\((SUS-\d+)\)/g, "Subject ($1)");

app.get("/health", (req, res) => res.json({ ok: true, service: "crime_api", ts: Date.now() }));

app.get("/stats", (req, res) => res.json(DB.stats()));

app.post("/query", async (req, res) => {
  try {
    const q = ((req.body && req.body.q) || "").toString().trim();
    if (!q) return res.status(400).json({ error: 'Missing "q"' });
    const role = (req.headers["x-ksp-role"] || "Investigator").toString();
    const scope = ROLE_SCOPES[role] || ROLE_SCOPES.Investigator;

    // (PROD) QuickML LLM parses free-form / Kannada → {intent, entities}; the
    // grounded engine then retrieves + cites. For now the engine parses directly:
    //   const parsed = await quickmlParse(q);
    const result = Engine.handle(q);

    // RBAC enforcement (pillar #10)
    if (result.intent === "financial" && !scope.financial) {
      return res.json({ blocked: true, reason: `RBAC: financial analysis not permitted for role ${role}` });
    }
    if (!scope.pii) {
      result.answerEN = maskPII(result.answerEN);
      result.answerKN = maskPII(result.answerKN);
      if (result.risk) result.risk.subject = maskPII(result.risk.subject);
    }

    // (PROD) audit to Data Store + emit a Signal; (PROD) Zia AutoML risk via ziaScore()
    //   await writeAudit({ ts: Date.now(), role, action: "query", detail: q });

    res.json({
      intent: result.intent,
      answer: result.answerEN,
      answer_kn: result.answerKN,
      sources: result.sources,
      cases: (result.cases || []).slice(0, 50),
      network: result.network,
      prediction: result.prediction,
      risk: result.risk,
      financial: result.financial,
      socio: result.socio
    });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
});

// ---- Production integration points (implement against Catalyst SDKs) ----
//   quickmlParse(q)        -> Catalyst QuickML LLM Serving => {intent, entities}
//   ziaScore(accusedRow)   -> Catalyst Zia AutoML          => risk / forecast
//   ziaSpeechToText(audio) -> Catalyst Zia Services        => transcript (en-IN/kn-IN)
//   smartBrowzPdf(html)    -> Catalyst SmartBrowz          => PDF -> store in Stratus
// -------------------------------------------------------------------------

module.exports = app;
