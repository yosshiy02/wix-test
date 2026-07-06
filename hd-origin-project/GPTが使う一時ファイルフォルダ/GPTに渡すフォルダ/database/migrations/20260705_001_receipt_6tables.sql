-- ============================================================
-- Migration: 20260705_001_receipt_6tables
-- Purpose  : レシートDB 下書き3テーブル・本保存3テーブル追加
-- Note     : 既存 receipt_imports / receipt_ai_drafts / receipt_tax_breakdowns は削除しない
-- ============================================================
-- ============================================================
-- レシートDB 6テーブル追加
-- 注意:
--   このmigrationはレシートDB 6テーブルを追加する。
--   既存 receipt_imports / receipt_ai_drafts / receipt_tax_breakdowns は削除しない。
--   実行前にDBバックアップを確認する。
-- ============================================================

CREATE SCHEMA IF NOT EXISTS accounting;

-- ============================================================
-- 1. 下書きレシート
-- ============================================================

CREATE TABLE IF NOT EXISTS accounting.receipt_drafts (
  draft_receipt_id BIGSERIAL PRIMARY KEY,

  receipt_import_id BIGINT REFERENCES accounting.receipt_imports(id) ON DELETE SET NULL,

  receipt_name TEXT,
  receipt_image_path TEXT,
  receipt_imported_at TIMESTAMP,
  image_hash_sha256 TEXT,

  draft_status TEXT NOT NULL DEFAULT '取込済み',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_receipt_drafts_import_id
ON accounting.receipt_drafts(receipt_import_id);

CREATE INDEX IF NOT EXISTS ix_receipt_drafts_hash
ON accounting.receipt_drafts(image_hash_sha256);


-- ============================================================
-- 2. 下書きレシート明細
-- ============================================================

CREATE TABLE IF NOT EXISTS accounting.receipt_draft_details (
  draft_receipt_detail_id BIGSERIAL PRIMARY KEY,

  draft_receipt_id BIGINT NOT NULL
    REFERENCES accounting.receipt_drafts(draft_receipt_id)
    ON DELETE CASCADE,

  receipt_import_id BIGINT REFERENCES accounting.receipt_imports(id) ON DELETE SET NULL,

  transaction_date DATE,
  receipt_time_text TEXT,

  vendor_name TEXT,
  vendor_address TEXT,
  vendor_phone TEXT,

  payment_method_id BIGINT REFERENCES expenses.payment_methods(payment_method_id),

  total_amount NUMERIC(14,2),
  tax_total_amount NUMERIC(14,2),

  invoice_number TEXT,
  invoice_type_id BIGINT REFERENCES expenses.invoice_types(invoice_type_id),

  evidence_type_id BIGINT REFERENCES expenses.evidence_types(evidence_type_id),
  evidence_memo TEXT,

  target_person_id BIGINT REFERENCES expenses.target_people(target_person_id),

  summary TEXT,
  memo TEXT,

  account_title_id BIGINT REFERENCES expenses.account_titles(account_title_id),
  purpose_id BIGINT REFERENCES expenses.purposes(purpose_id),
  project_id BIGINT REFERENCES expenses.projects(project_id),
  department_id BIGINT REFERENCES expenses.departments(department_id),

  ocr_raw_text TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_receipt_draft_details_draft_receipt_id
ON accounting.receipt_draft_details(draft_receipt_id);

CREATE INDEX IF NOT EXISTS ix_receipt_draft_details_import_id
ON accounting.receipt_draft_details(receipt_import_id);


-- ============================================================
-- 3. 下書きレシート明細内訳
-- ============================================================

CREATE TABLE IF NOT EXISTS accounting.receipt_draft_detail_breakdowns (
  draft_receipt_detail_breakdown_id BIGSERIAL PRIMARY KEY,

  draft_receipt_id BIGINT NOT NULL
    REFERENCES accounting.receipt_drafts(draft_receipt_id)
    ON DELETE CASCADE,

  draft_receipt_detail_id BIGINT NOT NULL
    REFERENCES accounting.receipt_draft_details(draft_receipt_detail_id)
    ON DELETE CASCADE,

  item_name TEXT,
  quantity NUMERIC(14,4),
  unit_price NUMERIC(14,2),
  amount NUMERIC(14,2),

  tax_category_id BIGINT REFERENCES expenses.tax_categories(tax_category_id),
  tax_treatment_id BIGINT REFERENCES expenses.tax_treatments(tax_treatment_id),

  note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_receipt_draft_breakdowns_draft_receipt_id
ON accounting.receipt_draft_detail_breakdowns(draft_receipt_id);

CREATE INDEX IF NOT EXISTS ix_receipt_draft_breakdowns_detail_id
ON accounting.receipt_draft_detail_breakdowns(draft_receipt_detail_id);


-- ============================================================
-- 4. 本保存レシート
-- ============================================================

CREATE TABLE IF NOT EXISTS accounting.receipts (
  receipt_id BIGSERIAL PRIMARY KEY,

  source_draft_receipt_id BIGINT REFERENCES accounting.receipt_drafts(draft_receipt_id) ON DELETE SET NULL,
  receipt_import_id BIGINT REFERENCES accounting.receipt_imports(id) ON DELETE SET NULL,

  receipt_name TEXT,
  receipt_image_path TEXT,
  receipt_imported_at TIMESTAMP,
  image_hash_sha256 TEXT,

  saved_status TEXT NOT NULL DEFAULT '本保存済み',
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_receipts_source_draft_id
ON accounting.receipts(source_draft_receipt_id);

CREATE INDEX IF NOT EXISTS ix_receipts_import_id
ON accounting.receipts(receipt_import_id);

CREATE INDEX IF NOT EXISTS ix_receipts_hash
ON accounting.receipts(image_hash_sha256);


-- ============================================================
-- 5. 本保存レシート明細
-- ============================================================

CREATE TABLE IF NOT EXISTS accounting.receipt_details (
  receipt_detail_id BIGSERIAL PRIMARY KEY,

  receipt_id BIGINT NOT NULL
    REFERENCES accounting.receipts(receipt_id)
    ON DELETE CASCADE,

  source_draft_receipt_detail_id BIGINT
    REFERENCES accounting.receipt_draft_details(draft_receipt_detail_id)
    ON DELETE SET NULL,

  transaction_date DATE,
  receipt_time_text TEXT,

  vendor_name TEXT,
  vendor_address TEXT,
  vendor_phone TEXT,

  payment_method_id BIGINT REFERENCES expenses.payment_methods(payment_method_id),

  total_amount NUMERIC(14,2),
  tax_total_amount NUMERIC(14,2),

  invoice_number TEXT,
  invoice_type_id BIGINT REFERENCES expenses.invoice_types(invoice_type_id),

  evidence_type_id BIGINT REFERENCES expenses.evidence_types(evidence_type_id),
  evidence_memo TEXT,

  target_person_id BIGINT REFERENCES expenses.target_people(target_person_id),

  summary TEXT,
  memo TEXT,

  account_title_id BIGINT REFERENCES expenses.account_titles(account_title_id),
  purpose_id BIGINT REFERENCES expenses.purposes(purpose_id),
  project_id BIGINT REFERENCES expenses.projects(project_id),
  department_id BIGINT REFERENCES expenses.departments(department_id),

  ocr_raw_text TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_receipt_details_receipt_id
ON accounting.receipt_details(receipt_id);

CREATE INDEX IF NOT EXISTS ix_receipt_details_source_draft_detail_id
ON accounting.receipt_details(source_draft_receipt_detail_id);


-- ============================================================
-- 6. 本保存レシート明細内訳
-- ============================================================

CREATE TABLE IF NOT EXISTS accounting.receipt_detail_breakdowns (
  receipt_detail_breakdown_id BIGSERIAL PRIMARY KEY,

  receipt_id BIGINT NOT NULL
    REFERENCES accounting.receipts(receipt_id)
    ON DELETE CASCADE,

  receipt_detail_id BIGINT NOT NULL
    REFERENCES accounting.receipt_details(receipt_detail_id)
    ON DELETE CASCADE,

  source_draft_receipt_detail_breakdown_id BIGINT
    REFERENCES accounting.receipt_draft_detail_breakdowns(draft_receipt_detail_breakdown_id)
    ON DELETE SET NULL,

  item_name TEXT,
  quantity NUMERIC(14,4),
  unit_price NUMERIC(14,2),
  amount NUMERIC(14,2),

  tax_category_id BIGINT REFERENCES expenses.tax_categories(tax_category_id),
  tax_treatment_id BIGINT REFERENCES expenses.tax_treatments(tax_treatment_id),

  note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_receipt_breakdowns_receipt_id
ON accounting.receipt_detail_breakdowns(receipt_id);

CREATE INDEX IF NOT EXISTS ix_receipt_breakdowns_detail_id
ON accounting.receipt_detail_breakdowns(receipt_detail_id);

CREATE INDEX IF NOT EXISTS ix_receipt_breakdowns_source_draft_breakdown_id
ON accounting.receipt_detail_breakdowns(source_draft_receipt_detail_breakdown_id);



