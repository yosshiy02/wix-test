const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const config = require("./config");

function quoteIdent(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

function connection(database) {
  return {
    host: config.db.host,
    port: config.db.port,
    database,
    user: config.db.user,
    password: String(config.db.password || "")
  };
}

async function withClient(database, fn) {
  const client = new Client(connection(database));
  await client.connect();

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function databaseExists(dbName) {
  return await withClient("postgres", async client => {
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    return result.rowCount > 0;
  });
}

async function createDatabase(dbName) {
  await withClient("postgres", async client => {
    await client.query(`CREATE DATABASE ${quoteIdent(dbName)}`);
  });
}

function readSqlIfExists(relativePath) {
  const fullPath = path.join(config.projectRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    return "";
  }

  return fs.readFileSync(fullPath, "utf8");
}

async function runTargetSql(sql) {
  if (!String(sql || "").trim()) return;

  await withClient(config.db.database, async client => {
    await client.query(sql);
  });
}

async function ensureDatabaseReady() {
  const dbName = config.db.database;

  if (!dbName) {
    throw new Error("DB_NAME が .env にありません。");
  }

  const exists = await databaseExists(dbName);

  if (!exists) {
    console.log(`[DB] database not found. create: ${dbName}`);
    await createDatabase(dbName);
  }

  const baseSql = `
CREATE SCHEMA IF NOT EXISTS accounting;

CREATE TABLE IF NOT EXISTS accounting.receipt_imports (
  id BIGSERIAL PRIMARY KEY,
  upload_id TEXT,
  wix_item_id TEXT,
  wix_image_url TEXT,
  local_image_file_name TEXT,
  local_image_path TEXT,
  image_hash_sha256 TEXT,
  image_size_bytes BIGINT,
  original_file_name TEXT,
  captured_at_jst TIMESTAMP,
  imported_at_jst TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  import_batch_id TEXT,
  ocr_provider TEXT,
  ocr_raw_text TEXT,
  ocr_line_count INTEGER,
  ocr_word_count INTEGER,
  status TEXT NOT NULL DEFAULT 'imported',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE accounting.receipt_imports
  ADD COLUMN IF NOT EXISTS upload_id TEXT,
  ADD COLUMN IF NOT EXISTS wix_item_id TEXT,
  ADD COLUMN IF NOT EXISTS wix_image_url TEXT,
  ADD COLUMN IF NOT EXISTS local_image_file_name TEXT,
  ADD COLUMN IF NOT EXISTS local_image_path TEXT,
  ADD COLUMN IF NOT EXISTS image_hash_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS image_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS original_file_name TEXT,
  ADD COLUMN IF NOT EXISTS captured_at_jst TIMESTAMP,
  ADD COLUMN IF NOT EXISTS imported_at_jst TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS import_batch_id TEXT,
  ADD COLUMN IF NOT EXISTS ocr_provider TEXT,
  ADD COLUMN IF NOT EXISTS ocr_raw_text TEXT,
  ADD COLUMN IF NOT EXISTS ocr_line_count INTEGER,
  ADD COLUMN IF NOT EXISTS ocr_word_count INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'imported',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS ux_receipt_imports_upload_id
ON accounting.receipt_imports (upload_id)
WHERE upload_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_receipt_imports_wix_item_id
ON accounting.receipt_imports (wix_item_id)
WHERE wix_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_receipt_imports_hash
ON accounting.receipt_imports (image_hash_sha256)
WHERE image_hash_sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS accounting.receipt_ai_drafts (
  id BIGSERIAL PRIMARY KEY,
  receipt_import_id BIGINT NOT NULL REFERENCES accounting.receipt_imports(id) ON DELETE CASCADE,
  transaction_date DATE,
  vendor_name TEXT,
  total_amount NUMERIC(14,2),
  tax_amount NUMERIC(14,2),
  tax_rate TEXT,
  tax_treatment_name TEXT,
  payment_method_name TEXT,
  account_title_name TEXT,
  invoice_number TEXT,
  summary TEXT,
  memo TEXT,
  confidence INTEGER,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  ai_model TEXT,
  ai_raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE accounting.receipt_ai_drafts
  ADD COLUMN IF NOT EXISTS receipt_import_id BIGINT,
  ADD COLUMN IF NOT EXISTS transaction_date DATE,
  ADD COLUMN IF NOT EXISTS vendor_name TEXT,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS tax_rate TEXT,
  ADD COLUMN IF NOT EXISTS tax_treatment_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_name TEXT,
  ADD COLUMN IF NOT EXISTS account_title_name TEXT,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS memo TEXT,
  ADD COLUMN IF NOT EXISTS confidence INTEGER,
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS ai_model TEXT,
  ADD COLUMN IF NOT EXISTS ai_raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS ix_receipt_ai_drafts_receipt_import_id
ON accounting.receipt_ai_drafts(receipt_import_id);

CREATE SCHEMA IF NOT EXISTS expenses;

CREATE TABLE IF NOT EXISTS expenses.account_titles (
  account_title_id BIGSERIAL PRIMARY KEY,
  account_code TEXT,
  account_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS account_titles_account_name_uidx
ON expenses.account_titles(account_name);

CREATE TABLE IF NOT EXISTS expenses.payment_methods (
  payment_method_id BIGSERIAL PRIMARY KEY,
  method_name TEXT NOT NULL,
  default_credit_account TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_method_name_uidx
ON expenses.payment_methods(method_name);

CREATE TABLE IF NOT EXISTS expenses.tax_categories (
  tax_category_id BIGSERIAL PRIMARY KEY,
  tax_name TEXT NOT NULL,
  tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS tax_categories_tax_name_uidx
ON expenses.tax_categories(tax_name);


CREATE TABLE IF NOT EXISTS expenses.tax_treatments (
  tax_treatment_id BIGSERIAL PRIMARY KEY,
  treatment_name TEXT NOT NULL,
  treatment_code TEXT,
  is_tax_included BOOLEAN,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS tax_treatments_treatment_name_uidx
ON expenses.tax_treatments(treatment_name);
CREATE TABLE IF NOT EXISTS expenses.vendors (
  vendor_id BIGSERIAL PRIMARY KEY,
  vendor_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS vendors_vendor_name_uidx
ON expenses.vendors(vendor_name);

CREATE TABLE IF NOT EXISTS expenses.target_people (
  target_person_id BIGSERIAL PRIMARY KEY,
  target_person_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS target_people_target_person_name_uidx
ON expenses.target_people(target_person_name);

CREATE TABLE IF NOT EXISTS expenses.purposes (
  purpose_id BIGSERIAL PRIMARY KEY,
  purpose_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS purposes_purpose_name_uidx
ON expenses.purposes(purpose_name);

CREATE TABLE IF NOT EXISTS expenses.projects (
  project_id BIGSERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_project_name_uidx
ON expenses.projects(project_name);

CREATE TABLE IF NOT EXISTS expenses.departments (
  department_id BIGSERIAL PRIMARY KEY,
  department_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS departments_department_name_uidx
ON expenses.departments(department_name);

CREATE TABLE IF NOT EXISTS expenses.expense_headers (
  expense_id BIGSERIAL PRIMARY KEY,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id BIGINT,
  vendor_name TEXT,
  payment_method_id BIGINT,
  payment_method_name TEXT,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_person_id BIGINT,
  target_person TEXT,
  purpose_id BIGINT,
  purpose TEXT,
  project_id BIGINT,
  project_name TEXT,
  department_id BIGINT,
  department_name TEXT,
  invoice_status TEXT,
  invoice_number TEXT,
  evidence_type TEXT,
  evidence_memo TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expenses.expense_headers
  ADD COLUMN IF NOT EXISTS expense_date DATE,
  ADD COLUMN IF NOT EXISTS vendor_id BIGINT,
  ADD COLUMN IF NOT EXISTS vendor_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_id BIGINT,
  ADD COLUMN IF NOT EXISTS payment_method_name TEXT,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_person_id BIGINT,
  ADD COLUMN IF NOT EXISTS target_person TEXT,
  ADD COLUMN IF NOT EXISTS purpose_id BIGINT,
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS project_id BIGINT,
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS department_id BIGINT,
  ADD COLUMN IF NOT EXISTS department_name TEXT,
  ADD COLUMN IF NOT EXISTS invoice_status TEXT,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS evidence_type TEXT,
  ADD COLUMN IF NOT EXISTS evidence_memo TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS expenses.expense_details (
  detail_id BIGSERIAL PRIMARY KEY,
  expense_id BIGINT NOT NULL REFERENCES expenses.expense_headers(expense_id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 1,
  account_title_id BIGINT,
  account_title_name TEXT,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_category_id BIGINT,
  tax_category_name TEXT,
  tax_treatment_id BIGINT,
  tax_treatment_name TEXT,
  tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expenses.expense_details
  ADD COLUMN IF NOT EXISTS expense_id BIGINT,
  ADD COLUMN IF NOT EXISTS line_no INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS account_title_id BIGINT,
  ADD COLUMN IF NOT EXISTS account_title_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_category_id BIGINT,
  ADD COLUMN IF NOT EXISTS tax_category_name TEXT,
  ADD COLUMN IF NOT EXISTS tax_treatment_id BIGINT,
  ADD COLUMN IF NOT EXISTS tax_treatment_name TEXT,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memo TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- RECEIPT_RELATIONSHIP_SCHEMA_START

-- RECEIPT_AI_DRAFT_VENDOR_COLUMNS_20260703_START

ALTER TABLE accounting.receipt_ai_drafts
  ADD COLUMN IF NOT EXISTS vendor_address TEXT,
  ADD COLUMN IF NOT EXISTS vendor_phone TEXT,
  ADD COLUMN IF NOT EXISTS receipt_time_text TEXT;

-- RECEIPT_AI_DRAFT_VENDOR_COLUMNS_20260703_END

-- RECEIPT_TEMP_MASTER_NAMES_SCHEMA_20260703_START

ALTER TABLE accounting.receipt_ai_drafts
  ADD COLUMN IF NOT EXISTS purpose_temp_name TEXT,
  ADD COLUMN IF NOT EXISTS project_temp_name TEXT,
  ADD COLUMN IF NOT EXISTS department_temp_name TEXT;

-- RECEIPT_TEMP_MASTER_NAMES_SCHEMA_20260703_END

-- RECEIPT_INVOICE_EVIDENCE_MASTERS_START

CREATE TABLE IF NOT EXISTS expenses.invoice_types (
  invoice_type_id BIGSERIAL PRIMARY KEY,
  invoice_type_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses.evidence_types (
  evidence_type_id BIGSERIAL PRIMARY KEY,
  evidence_type_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO expenses.invoice_types (invoice_type_name, sort_order)
SELECT '\u9069\u683C\u8ACB\u6C42\u66F8', 10
WHERE NOT EXISTS (
  SELECT 1 FROM expenses.invoice_types WHERE invoice_type_name = '\u9069\u683C\u8ACB\u6C42\u66F8'
);

INSERT INTO expenses.invoice_types (invoice_type_name, sort_order)
SELECT '\u975E\u9069\u683C\u8ACB\u6C42\u66F8', 20
WHERE NOT EXISTS (
  SELECT 1 FROM expenses.invoice_types WHERE invoice_type_name = '\u975E\u9069\u683C\u8ACB\u6C42\u66F8'
);

INSERT INTO expenses.invoice_types (invoice_type_name, sort_order)
SELECT '\u5BFE\u8C61\u5916', 90
WHERE NOT EXISTS (
  SELECT 1 FROM expenses.invoice_types WHERE invoice_type_name = '\u5BFE\u8C61\u5916'
);

INSERT INTO expenses.evidence_types (evidence_type_name, sort_order)
SELECT '\u30EC\u30B7\u30FC\u30C8', 10
WHERE NOT EXISTS (
  SELECT 1 FROM expenses.evidence_types WHERE evidence_type_name = '\u30EC\u30B7\u30FC\u30C8'
);

INSERT INTO expenses.evidence_types (evidence_type_name, sort_order)
SELECT '\u9818\u53CE\u66F8', 20
WHERE NOT EXISTS (
  SELECT 1 FROM expenses.evidence_types WHERE evidence_type_name = '\u9818\u53CE\u66F8'
);

INSERT INTO expenses.evidence_types (evidence_type_name, sort_order)
SELECT '\u8ACB\u6C42\u66F8', 30
WHERE NOT EXISTS (
  SELECT 1 FROM expenses.evidence_types WHERE evidence_type_name = '\u8ACB\u6C42\u66F8'
);

INSERT INTO expenses.evidence_types (evidence_type_name, sort_order)
SELECT '\u305D\u306E\u4ED6', 90
WHERE NOT EXISTS (
  SELECT 1 FROM expenses.evidence_types WHERE evidence_type_name = '\u305D\u306E\u4ED6'
);

-- RECEIPT_INVOICE_EVIDENCE_MASTERS_END

ALTER TABLE accounting.receipt_ai_drafts
  ADD COLUMN IF NOT EXISTS payment_method_id BIGINT,
  ADD COLUMN IF NOT EXISTS target_person_id BIGINT,
  ADD COLUMN IF NOT EXISTS purpose_id BIGINT,
  ADD COLUMN IF NOT EXISTS project_id BIGINT,
  ADD COLUMN IF NOT EXISTS department_id BIGINT,
  ADD COLUMN IF NOT EXISTS invoice_type_id BIGINT,
  ADD COLUMN IF NOT EXISTS evidence_type_id BIGINT,
  ADD COLUMN IF NOT EXISTS evidence_memo TEXT;

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

-- RECEIPT_RELATIONSHIP_SCHEMA_END
INSERT INTO expenses.account_titles (account_code, account_name, sort_order)
VALUES
('001', '消耗品費', 10),
('002', '旅費交通費', 20),
('003', '通信費', 30),
('004', '荷造運賃', 40),
('005', '支払手数料', 50),
('006', '広告宣伝費', 60),
('007', '地代家賃', 70),
('008', '水道光熱費', 80),
('009', '雑費', 90),
('010', '仕入高', 100)
ON CONFLICT (account_name) DO UPDATE SET
  account_code = EXCLUDED.account_code,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO expenses.payment_methods (method_name, default_credit_account, sort_order)
VALUES
('現金', '現金', 10),
('普通預金', '普通預金', 20),
('銀行振込', '普通預金', 30),
('口座引落', '普通預金', 40),
('クレジットカード', '未払金', 50)
ON CONFLICT (method_name) DO UPDATE SET
  default_credit_account = EXCLUDED.default_credit_account,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO expenses.tax_categories (tax_name, tax_rate, sort_order)
VALUES
('課税10%', 0.1000, 10),
('軽減8%', 0.0800, 20),
('非課税', 0.0000, 30),
('不課税', 0.0000, 40),
('対象外', 0.0000, 50)
ON CONFLICT (tax_name) DO UPDATE SET
  tax_rate = EXCLUDED.tax_rate,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO expenses.tax_treatments (treatment_name, treatment_code, is_tax_included, sort_order)
VALUES
('税込・内税', 'tax_included', TRUE, 10),
('税抜・外税', 'tax_excluded', FALSE, 20),
('非課税', 'non_taxable', NULL, 30),
('不課税', 'out_of_scope', NULL, 40),
('免税', 'tax_exempt', NULL, 50),
('対象外', 'not_applicable', NULL, 60),
('不明', 'unknown', NULL, 90)
ON CONFLICT (treatment_name) DO UPDATE SET
  treatment_code = EXCLUDED.treatment_code,
  is_tax_included = EXCLUDED.is_tax_included,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;
`;

  await runTargetSql(baseSql);

  const masterSql =
    readSqlIfExists(path.join("database", "expenses", "master_management_setup.sql")) ||
    readSqlIfExists(path.join("database", "expenses", "add_classification_masters.sql"));

  if (masterSql.trim()) {
    await runTargetSql(masterSql);
  }

  /* GPT00_ORGANIZATION_MASTER_MIGRATION_START */
  const organizationMasterSql = readSqlIfExists(
    path.join(
      "database",
      "migrations",
      "20260710_003_company_person_position_permission_masters.sql"
    )
  ).replace(/^\uFEFF/, "");

  if (organizationMasterSql.trim()) {
    await runTargetSql(organizationMasterSql);
  }
  /* GPT00_ORGANIZATION_MASTER_MIGRATION_END */
  /* GPT00_BUSINESS_PARTNER_BOOTSTRAP_20260712_START */
  const businessPartnerMigrationSql = readSqlIfExists(
    path.join(
      "database",
      "migrations",
      "20260712_001_customer_vendor_csv_import.sql"
    )
  ).replace(/^\uFEFF/, "");

  if (businessPartnerMigrationSql.trim()) {
    await runTargetSql(businessPartnerMigrationSql);
  }
  /* GPT00_BUSINESS_PARTNER_BOOTSTRAP_20260712_END */
  /* GPT00_COMPANY_TRANSACTION_RULE_BOOTSTRAP_20260712_START */
  const companyTransactionRuleMigrationSql = readSqlIfExists(
    path.join(
      "database",
      "migrations",
      "20260712_002_company_transaction_rules.sql"
    )
  ).replace(/^\uFEFF/, "");

  if (companyTransactionRuleMigrationSql.trim()) {
    await runTargetSql(companyTransactionRuleMigrationSql);
  }
  /* GPT00_COMPANY_TRANSACTION_RULE_BOOTSTRAP_20260712_END */
  /* GPT00_SALES_MANAGEMENT_BOOTSTRAP_20260712_START */
  const salesManagementMigrationSql = readSqlIfExists(
    path.join(
      "database",
      "migrations",
      "20260712_003_sales_management_skeleton.sql"
    )
  ).replace(/^\uFEFF/, "");

  if (salesManagementMigrationSql.trim()) {
    await runTargetSql(salesManagementMigrationSql);
  }
  /* GPT00_SALES_MANAGEMENT_BOOTSTRAP_20260712_END */
  /* GPT00_SALES_COMPANY_SCOPE_BOOTSTRAP_20260712_START */
  const salesCompanyScopeMigrationSql = readSqlIfExists(
    path.join(
      "database",
      "migrations",
      "20260712_004_sales_company_scope.sql"
    )
  ).replace(/^\uFEFF/, "");

  if (salesCompanyScopeMigrationSql.trim()) {
    await runTargetSql(salesCompanyScopeMigrationSql);
  }
  /* GPT00_SALES_COMPANY_SCOPE_BOOTSTRAP_20260712_END */
  console.log(`[DB] ready: ${dbName}`);

  /*
    GPT00_PAYMENT_DOCUMENT_OCR_BOOTSTRAP_20260711

    CIL専門テーブルが外部キー参照する
    accounting.payment_document_ocr_imports を先に作成する。
    CREATE TABLE IF NOT EXISTSを使用する既存マイグレーションなので、
    既存DBに対しても安全に再実行できる。
  */
  /* GPT00_PAYMENT_DOCUMENT_OCR_BOOTSTRAP_20260711_START */
  const paymentDocumentOcrMigrationSql = readSqlIfExists(
    path.join(
      "database",
      "migrations",
      "20260707_005_payment_document_ocr_imports.sql"
    )
  ).replace(/^\uFEFF/, "");

  if (paymentDocumentOcrMigrationSql.trim()) {
    await runTargetSql(paymentDocumentOcrMigrationSql);
  }
  /* GPT00_PAYMENT_DOCUMENT_OCR_BOOTSTRAP_20260711_END */
  /*
    GPT00_PAYMENT_DOCUMENT_SORTING_BOOTSTRAP_20260711

    CIL専門テーブルが参照する
    accounting.payment_document_sorting_drafts を先に作成する。
  */
  /* GPT00_PAYMENT_DOCUMENT_SORTING_BOOTSTRAP_20260711_START */
  const paymentDocumentSortingMigrationSql = readSqlIfExists(
    path.join(
      "database",
      "migrations",
      "20260707_006_payment_document_sorting_drafts.sql"
    )
  ).replace(/^\uFEFF/, "");

  if (paymentDocumentSortingMigrationSql.trim()) {
    await runTargetSql(paymentDocumentSortingMigrationSql);
  }
  /* GPT00_PAYMENT_DOCUMENT_SORTING_BOOTSTRAP_20260711_END */
  /*
    GPT00_PAYMENT_DOCUMENT_SPECIALIST_BOOTSTRAP_20260711

    CIL専門テーブルが参照する
    accounting.payment_document_specialist_analysis_results を先に作成する。
  */
  /* GPT00_PAYMENT_DOCUMENT_SPECIALIST_BOOTSTRAP_20260711_START */
  const paymentDocumentSpecialistMigrationSql = readSqlIfExists(
    path.join(
      "database",
      "migrations",
      "20260710_002_payment_document_specialist_link.sql"
    )
  ).replace(/^\uFEFF/, "");

  if (paymentDocumentSpecialistMigrationSql.trim()) {
    await runTargetSql(paymentDocumentSpecialistMigrationSql);
  }
  /* GPT00_PAYMENT_DOCUMENT_SPECIALIST_BOOTSTRAP_20260711_END */
  /*
    HD_ORIGIN_CIL_BOOTSTRAP_20260711

    CIL専門DBマイグレーションを起動時に安全適用する。
    UTF-8 BOMを除去し、既存のrunTargetSql経由で実行する。
  */
  const cilMigrationSql = readSqlIfExists(
    path.join(
      "database",
      "migrations",
      "20260710_003_contract_insurance_lease_drafts_foundation.sql"
    )
  ).replace(/^\uFEFF/, "");

  if (cilMigrationSql.trim()) {
    await runTargetSql(cilMigrationSql);
  }

  /*
    HD_ORIGIN_CIL_MASTERS_BOOTSTRAP_20260711

    契約・保険・リース系で使用する不足マスタを
    起動時に安全適用する。
  */
  const cilMissingMastersSql = readSqlIfExists(
    path.join(
      "database",
      "migrations",
      "20260708_006_contract_insurance_lease_missing_masters.sql"
    )
  ).replace(/^\uFEFF/, "");

  if (cilMissingMastersSql.trim()) {
    await runTargetSql(cilMissingMastersSql);
  }
}

module.exports = {
  ensureDatabaseReady
};
