BEGIN;

CREATE SCHEMA IF NOT EXISTS expenses;

CREATE TABLE IF NOT EXISTS expenses.document_types (
  document_type_id SERIAL PRIMARY KEY,
  document_type_code VARCHAR(50),
  document_type_name VARCHAR(120) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expenses.document_types ADD COLUMN IF NOT EXISTS document_type_code VARCHAR(50);
ALTER TABLE expenses.document_types ADD COLUMN IF NOT EXISTS document_type_name VARCHAR(120);
ALTER TABLE expenses.document_types ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE expenses.document_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE expenses.document_types ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE expenses.document_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ux_document_types_name ON expenses.document_types (document_type_name);
CREATE UNIQUE INDEX IF NOT EXISTS ux_document_types_code ON expenses.document_types (document_type_code) WHERE document_type_code IS NOT NULL;

INSERT INTO expenses.document_types (document_type_code, document_type_name, sort_order, is_active) VALUES
  ('invoice', '請求書', 10, TRUE),
  ('tax_payment_notice', '納付書・納税通知書', 20, TRUE),
  ('receipt', '領収書', 30, TRUE),
  ('web_statement', 'Web明細', 40, TRUE),
  ('card_statement', 'カード利用明細', 50, TRUE),
  ('utility_notice', '公共料金通知書', 60, TRUE),
  ('insurance_notice', '保険料通知書', 70, TRUE),
  ('lease_contract', 'リース契約書', 80, TRUE),
  ('mail_saved', 'メール保存', 90, TRUE),
  ('contract', '契約書', 100, TRUE),
  ('other', 'その他', 999, TRUE)
ON CONFLICT (document_type_name)
DO UPDATE SET
  document_type_code = EXCLUDED.document_type_code,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses.payment_destinations (
  payment_destination_id SERIAL PRIMARY KEY,
  payment_destination_code VARCHAR(50),
  payment_destination_name VARCHAR(120) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expenses.payment_destinations ADD COLUMN IF NOT EXISTS payment_destination_code VARCHAR(50);
ALTER TABLE expenses.payment_destinations ADD COLUMN IF NOT EXISTS payment_destination_name VARCHAR(120);
ALTER TABLE expenses.payment_destinations ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE expenses.payment_destinations ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE expenses.payment_destinations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE expenses.payment_destinations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_destinations_name ON expenses.payment_destinations (payment_destination_name);
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_destinations_code ON expenses.payment_destinations (payment_destination_code) WHERE payment_destination_code IS NOT NULL;

INSERT INTO expenses.payment_destinations (payment_destination_code, payment_destination_name, sort_order, is_active) VALUES
  ('payable', '未払管理', 10, TRUE),
  ('accounts_payable', '買掛管理', 20, TRUE),
  ('expense', '経費管理', 30, TRUE),
  ('tax_public', '税金・公的支払い', 40, TRUE),
  ('card_payable', 'カード未払', 50, TRUE),
  ('contract_insurance_lease', '契約・保険・リース', 60, TRUE),
  ('no_process', '処理対象外', 900, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT (payment_destination_name)
DO UPDATE SET
  payment_destination_code = EXCLUDED.payment_destination_code,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses.accounting_categories (
  accounting_category_id SERIAL PRIMARY KEY,
  accounting_category_code VARCHAR(50),
  accounting_category_name VARCHAR(120) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expenses.accounting_categories ADD COLUMN IF NOT EXISTS accounting_category_code VARCHAR(50);
ALTER TABLE expenses.accounting_categories ADD COLUMN IF NOT EXISTS accounting_category_name VARCHAR(120);
ALTER TABLE expenses.accounting_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE expenses.accounting_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE expenses.accounting_categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE expenses.accounting_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ux_accounting_categories_name ON expenses.accounting_categories (accounting_category_name);
CREATE UNIQUE INDEX IF NOT EXISTS ux_accounting_categories_code ON expenses.accounting_categories (accounting_category_code) WHERE accounting_category_code IS NOT NULL;

INSERT INTO expenses.accounting_categories (accounting_category_code, accounting_category_name, sort_order, is_active) VALUES
  ('normal', '通常', 10, TRUE),
  ('advance_payment', '立替', 20, TRUE),
  ('tax', '税金', 30, TRUE),
  ('public_utility', '公共料金', 40, TRUE),
  ('insurance', '保険', 50, TRUE),
  ('lease', 'リース', 60, TRUE),
  ('asset', '資産', 70, TRUE),
  ('mixed_personal', '個人負担混在', 80, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT (accounting_category_name)
DO UPDATE SET
  accounting_category_code = EXCLUDED.accounting_category_code,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses.payable_kinds (
  payable_kind_id SERIAL PRIMARY KEY,
  payable_kind_code VARCHAR(50),
  payable_kind_name VARCHAR(120) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expenses.payable_kinds ADD COLUMN IF NOT EXISTS payable_kind_code VARCHAR(50);
ALTER TABLE expenses.payable_kinds ADD COLUMN IF NOT EXISTS payable_kind_name VARCHAR(120);
ALTER TABLE expenses.payable_kinds ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE expenses.payable_kinds ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE expenses.payable_kinds ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE expenses.payable_kinds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ux_payable_kinds_name ON expenses.payable_kinds (payable_kind_name);
CREATE UNIQUE INDEX IF NOT EXISTS ux_payable_kinds_code ON expenses.payable_kinds (payable_kind_code) WHERE payable_kind_code IS NOT NULL;

INSERT INTO expenses.payable_kinds (payable_kind_code, payable_kind_name, sort_order, is_active) VALUES
  ('accounts_payable', '買掛金', 10, TRUE),
  ('unpaid', '未払金', 20, TRUE),
  ('accrued_expense', '未払費用', 30, TRUE),
  ('card_payable', 'カード未払', 40, TRUE),
  ('other', 'その他', 999, TRUE)
ON CONFLICT (payable_kind_name)
DO UPDATE SET
  payable_kind_code = EXCLUDED.payable_kind_code,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses.payment_source_types (
  payment_source_type_id SERIAL PRIMARY KEY,
  payment_source_type_code VARCHAR(50),
  payment_source_type_name VARCHAR(120) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expenses.payment_source_types ADD COLUMN IF NOT EXISTS payment_source_type_code VARCHAR(50);
ALTER TABLE expenses.payment_source_types ADD COLUMN IF NOT EXISTS payment_source_type_name VARCHAR(120);
ALTER TABLE expenses.payment_source_types ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE expenses.payment_source_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE expenses.payment_source_types ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE expenses.payment_source_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_source_types_name ON expenses.payment_source_types (payment_source_type_name);
CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_source_types_code ON expenses.payment_source_types (payment_source_type_code) WHERE payment_source_type_code IS NOT NULL;

INSERT INTO expenses.payment_source_types (payment_source_type_code, payment_source_type_name, sort_order, is_active) VALUES
  ('scan_upload', 'スキャン・画像取込', 10, TRUE),
  ('pdf_upload', 'PDF取込', 20, TRUE),
  ('mail_saved', 'メール保存', 30, TRUE),
  ('web_download', 'Web明細ダウンロード', 40, TRUE),
  ('manual_upload', '手動アップロード', 50, TRUE),
  ('other', 'その他', 999, TRUE)
ON CONFLICT (payment_source_type_name)
DO UPDATE SET
  payment_source_type_code = EXCLUDED.payment_source_type_code,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = now();

COMMIT;