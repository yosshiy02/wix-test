CREATE SCHEMA IF NOT EXISTS accounting;

CREATE TABLE IF NOT EXISTS accounting.payment_document_sorting_drafts (
  payment_document_sorting_draft_id BIGSERIAL PRIMARY KEY,

  payment_document_ocr_import_id BIGINT NOT NULL
    REFERENCES accounting.payment_document_ocr_imports(payment_document_ocr_import_id)
    ON DELETE RESTRICT,

  draft_no TEXT NOT NULL DEFAULT '',
  draft_version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  draft_status TEXT NOT NULL DEFAULT 'draft',
  human_check_status TEXT NOT NULL DEFAULT 'unchecked',

  document_type_id BIGINT,
  document_type_code TEXT NOT NULL DEFAULT '',
  document_type_label TEXT NOT NULL DEFAULT '',

  payment_destination_id BIGINT,
  payment_destination_code TEXT NOT NULL DEFAULT '',
  payment_destination_label TEXT NOT NULL DEFAULT '',

  accounting_category_id BIGINT,
  accounting_category_code TEXT NOT NULL DEFAULT '',
  accounting_category_label TEXT NOT NULL DEFAULT '',

  payable_kind_id BIGINT,
  payable_kind_code TEXT NOT NULL DEFAULT '',
  payable_kind_label TEXT NOT NULL DEFAULT '',

  specialist_route_code TEXT NOT NULL DEFAULT '',
  specialist_route_label TEXT NOT NULL DEFAULT '',

  payment_target_label TEXT NOT NULL DEFAULT '',
  payable_target_label TEXT NOT NULL DEFAULT '',
  expense_target_label TEXT NOT NULL DEFAULT '',
  tax_public_label TEXT NOT NULL DEFAULT '',
  public_utility_label TEXT NOT NULL DEFAULT '',
  contract_insurance_lease_label TEXT NOT NULL DEFAULT '',

  ai_confidence TEXT NOT NULL DEFAULT '',
  ai_confidence_label TEXT NOT NULL DEFAULT '',
  ai_reason TEXT NOT NULL DEFAULT '',
  review_reason TEXT NOT NULL DEFAULT '',
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,

  ai_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  visible_fields_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  human_corrections_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,

  original_file_name TEXT NOT NULL DEFAULT '',
  saved_file_name TEXT NOT NULL DEFAULT '',
  saved_relative_path TEXT NOT NULL DEFAULT '',
  sha256 TEXT NOT NULL DEFAULT '',
  ocr_text_length INTEGER NOT NULL DEFAULT 0,

  display_rotation INTEGER NOT NULL DEFAULT 0,

  memo TEXT NOT NULL DEFAULT '',
  created_by_page TEXT NOT NULL DEFAULT 'payment-document-review',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_document_sorting_drafts_current
  ON accounting.payment_document_sorting_drafts(payment_document_ocr_import_id)
  WHERE is_current = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payment_document_sorting_drafts_ocr_import_id
  ON accounting.payment_document_sorting_drafts(payment_document_ocr_import_id);

CREATE INDEX IF NOT EXISTS idx_payment_document_sorting_drafts_status
  ON accounting.payment_document_sorting_drafts(draft_status, human_check_status);

CREATE INDEX IF NOT EXISTS idx_payment_document_sorting_drafts_document_type
  ON accounting.payment_document_sorting_drafts(document_type_code);

CREATE INDEX IF NOT EXISTS idx_payment_document_sorting_drafts_destination
  ON accounting.payment_document_sorting_drafts(payment_destination_code);

CREATE INDEX IF NOT EXISTS idx_payment_document_sorting_drafts_specialist_route
  ON accounting.payment_document_sorting_drafts(specialist_route_code);

CREATE INDEX IF NOT EXISTS idx_payment_document_sorting_drafts_created_at
  ON accounting.payment_document_sorting_drafts(created_at DESC);

CREATE OR REPLACE FUNCTION accounting.set_payment_document_sorting_drafts_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_document_sorting_drafts_updated_at
  ON accounting.payment_document_sorting_drafts;

CREATE TRIGGER trg_payment_document_sorting_drafts_updated_at
BEFORE UPDATE ON accounting.payment_document_sorting_drafts
FOR EACH ROW
EXECUTE FUNCTION accounting.set_payment_document_sorting_drafts_updated_at();

ALTER TABLE accounting.payment_document_ocr_imports
  ADD COLUMN IF NOT EXISTS draft_status TEXT NOT NULL DEFAULT '';

ALTER TABLE accounting.payment_document_ocr_imports
  ADD COLUMN IF NOT EXISTS latest_sorting_draft_id BIGINT;

ALTER TABLE accounting.payment_document_ocr_imports
  ADD COLUMN IF NOT EXISTS sorted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payment_document_ocr_imports_latest_sorting_draft
  ON accounting.payment_document_ocr_imports(latest_sorting_draft_id);
