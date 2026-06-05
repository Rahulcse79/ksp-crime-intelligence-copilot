-- =============================================================================
-- KSP Crime Intelligence Copilot — Catalyst Data Store schema (data model)
-- -----------------------------------------------------------------------------
-- Catalyst Data Store is relational. Create these tables via the Catalyst
-- console (or `catalyst datastore`) and query with ZCQL from the Function.
-- This schema mirrors the synthetic objects in data.js so the swap is 1:1.
-- Enable Full-Text Search on description / name columns where noted.
-- =============================================================================

-- Districts + socio-economic indicators (pillar #4)
CREATE TABLE districts (
  name           VARCHAR(64) PRIMARY KEY,
  lat            DOUBLE, lng DOUBLE,
  urban          INT,      -- urbanization %
  literacy       INT,      -- literacy %
  unemployment   DOUBLE,   -- %
  migration      DOUBLE,   -- in-migration index 0..1
  income         INT       -- per-capita income index
);

-- FIR / crime cases (pillar #1, #3) — FTS on description
CREATE TABLE fir_cases (
  id           VARCHAR(16) PRIMARY KEY,   -- e.g. KSP-10000
  fir_no       VARCHAR(32),
  crime_type   VARCHAR(48),
  severity     INT,
  occurred_on  DATE,
  district     VARCHAR(64),
  area         VARCHAR(64),
  lat          DOUBLE, lng DOUBLE,
  status       VARCHAR(32),
  modus        VARCHAR(255),
  description  TEXT,                       -- FULLTEXT
  phone        VARCHAR(16),
  vehicle      VARCHAR(24)
);

-- Accused / offenders (pillar #5) — risk_score from Zia AutoML in prod
CREATE TABLE accused (
  id           VARCHAR(16) PRIMARY KEY,   -- SUS-001
  name         VARCHAR(96),               -- FULLTEXT
  alias        VARCHAR(64),
  age          INT, gender CHAR(1),
  district     VARCHAR(64),
  status       VARCHAR(32),
  risk_score   INT
);

-- Victims (pillar #1, #2)
CREATE TABLE victims (
  id        VARCHAR(16) PRIMARY KEY,      -- VIC-0001
  name      VARCHAR(96),
  age       INT, gender CHAR(1),
  district  VARCHAR(64),
  case_id   VARCHAR(16),                  -- FK fir_cases.id
  loss      INT                           -- INR
);

-- Many-to-many: case ⇄ accused
CREATE TABLE case_accused ( case_id VARCHAR(16), accused_id VARCHAR(16) );

-- Criminal network edges (pillar #2)
CREATE TABLE associates ( a_id VARCHAR(16), b_id VARCHAR(16) );

-- Identifiers
CREATE TABLE phones   ( accused_id VARCHAR(16), number VARCHAR(16) );
CREATE TABLE vehicles ( accused_id VARCHAR(16), reg_no VARCHAR(24) );

-- Financial layer (pillar #7)
CREATE TABLE accounts (
  id                VARCHAR(16) PRIMARY KEY,  -- ACC-0001
  holder_accused_id VARCHAR(16),             -- NULL for mule/shell
  holder_name       VARCHAR(96),
  bank              VARCHAR(48),
  number            VARCHAR(24),
  mule              BOOLEAN
);
CREATE TABLE transactions (
  id        VARCHAR(16) PRIMARY KEY,         -- TXN-00001
  from_acc  VARCHAR(16),
  to_acc    VARCHAR(16),
  amount    INT,
  txn_date  DATE,
  case_id   VARCHAR(16),                     -- nullable
  flagged   BOOLEAN
);

-- Governance: write-once audit trail (pillar #10) — populate via Event Function
CREATE TABLE audit_log (
  id      BIGINT PRIMARY KEY AUTO_INCREMENT,
  ts      DATETIME,
  user_id VARCHAR(64),
  role    VARCHAR(32),
  action  VARCHAR(64),
  detail  VARCHAR(255)
);

-- Example ZCQL the Function would run instead of filtering data.js in memory:
--   SELECT id, crime_type, occurred_on, area, status FROM fir_cases
--   WHERE crime_type = 'Chain Snatching' AND district = 'Bengaluru'
--   ORDER BY occurred_on DESC;
