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
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memo TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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
`;

  await runTargetSql(baseSql);

  const masterSql =
    readSqlIfExists(path.join("database", "expenses", "master_management_setup.sql")) ||
    readSqlIfExists(path.join("database", "expenses", "add_classification_masters.sql"));

  if (masterSql.trim()) {
    await runTargetSql(masterSql);
  }

  console.log(`[DB] ready: ${dbName}`);
}

module.exports = {
  ensureDatabaseReady
};
