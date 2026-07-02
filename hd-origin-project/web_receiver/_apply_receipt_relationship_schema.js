const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function loadKeyValueFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log("[RUNTIME] not found:", filePath);
    return;
  }

  const text = fs.readFileSync(filePath, "utf8");

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index <= 0) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    if (key) {
      process.env[key] = value;
    }
  }

  console.log("[RUNTIME] loaded:", filePath);
}

function loadSecretEnv() {
  const candidates = [];

  if (process.env.HD_ORIGIN_ENV_PATH) {
    candidates.push(process.env.HD_ORIGIN_ENV_PATH);
  }

  candidates.push(path.join(projectRoot, ".env"));

  for (const envPath of candidates) {
    if (!envPath || !fs.existsSync(envPath)) continue;

    require("dotenv").config({ path: envPath, override: false });
    console.log("[ENV] loaded:", envPath);
    return;
  }

  console.log("[ENV] not found");
}

loadKeyValueFile(path.join(projectRoot, "HD_ORIGIN_RUNTIME_PATHS.txt"));
loadSecretEnv();

const { Client } = require("pg");
const config = require("./src/config");

const sql = String.raw`

ALTER TABLE accounting.receipt_ai_drafts
  ADD COLUMN IF NOT EXISTS payment_method_id BIGINT;

CREATE TABLE IF NOT EXISTS accounting.receipt_tax_breakdowns (
  id BIGSERIAL PRIMARY KEY,
  receipt_ai_draft_id BIGINT NOT NULL,
  tax_category_id BIGINT,
  tax_category_name TEXT NOT NULL DEFAULT '',
  tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  tax_treatment_id BIGINT,
  tax_treatment_name TEXT NOT NULL DEFAULT '',
  target_amount NUMERIC(14,2),
  tax_amount NUMERIC(14,2),
  ai_confidence NUMERIC(5,4),
  is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE accounting.receipt_tax_breakdowns
  ADD COLUMN IF NOT EXISTS receipt_ai_draft_id BIGINT,
  ADD COLUMN IF NOT EXISTS tax_category_id BIGINT,
  ADD COLUMN IF NOT EXISTS tax_category_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_treatment_id BIGINT,
  ADD COLUMN IF NOT EXISTS tax_treatment_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS receipt_tax_breakdowns_draft_idx
ON accounting.receipt_tax_breakdowns(receipt_ai_draft_id);

CREATE INDEX IF NOT EXISTS receipt_tax_breakdowns_category_idx
ON accounting.receipt_tax_breakdowns(tax_category_id);

CREATE INDEX IF NOT EXISTS receipt_tax_breakdowns_treatment_idx
ON accounting.receipt_tax_breakdowns(tax_treatment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'receipt_tax_breakdowns_draft_fkey'
  ) THEN
    ALTER TABLE accounting.receipt_tax_breakdowns
      ADD CONSTRAINT receipt_tax_breakdowns_draft_fkey
      FOREIGN KEY (receipt_ai_draft_id)
      REFERENCES accounting.receipt_ai_drafts(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'receipt_tax_breakdowns_category_fkey'
  ) THEN
    ALTER TABLE accounting.receipt_tax_breakdowns
      ADD CONSTRAINT receipt_tax_breakdowns_category_fkey
      FOREIGN KEY (tax_category_id)
      REFERENCES expenses.tax_categories(tax_category_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'receipt_tax_breakdowns_treatment_fkey'
  ) THEN
    ALTER TABLE accounting.receipt_tax_breakdowns
      ADD CONSTRAINT receipt_tax_breakdowns_treatment_fkey
      FOREIGN KEY (tax_treatment_id)
      REFERENCES expenses.tax_treatments(tax_treatment_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'receipt_ai_drafts_payment_method_fkey'
  ) THEN
    ALTER TABLE accounting.receipt_ai_drafts
      ADD CONSTRAINT receipt_ai_drafts_payment_method_fkey
      FOREIGN KEY (payment_method_id)
      REFERENCES expenses.payment_methods(payment_method_id);
  END IF;
END
$$;

`;

async function main() {
  const db = {
    host: config.db.host,
    port: Number(config.db.port),
    database: config.db.database,
    user: config.db.user,
    password: String(config.db.password || "")
  };

  console.log("\n[DB CONNECT]");
  console.log({
    host: db.host,
    port: db.port,
    database: db.database,
    user: db.user,
    password: db.password ? "********" : ""
  });

  if (!db.database) throw new Error("DB_NAME が読めていません。");
  if (!db.user) throw new Error("DB_USER が読めていません。");
  if (!db.password) throw new Error("DB_PASSWORD が読めていません。");

  const client = new Client(db);
  await client.connect();

  await client.query(sql);

  console.log("\n[確認: receipt_ai_drafts]");
  const draftColumns = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'receipt_ai_drafts'
      AND column_name IN ('payment_method_id', 'payment_method_name', 'tax_treatment_name')
    ORDER BY ordinal_position
  `);
  console.table(draftColumns.rows);

  console.log("\n[確認: receipt_tax_breakdowns columns]");
  const breakdownColumns = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'receipt_tax_breakdowns'
    ORDER BY ordinal_position
  `);
  console.table(breakdownColumns.rows);

  console.log("\n[確認: constraints]");
  const constraints = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conname IN (
      'receipt_tax_breakdowns_draft_fkey',
      'receipt_tax_breakdowns_category_fkey',
      'receipt_tax_breakdowns_treatment_fkey',
      'receipt_ai_drafts_payment_method_fkey'
    )
    ORDER BY conname
  `);
  console.table(constraints.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});