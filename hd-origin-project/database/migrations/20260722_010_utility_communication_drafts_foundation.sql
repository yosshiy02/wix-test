BEGIN;

CREATE TABLE IF NOT EXISTS accounting.payment_document_utility_communication_drafts (
  utility_communication_draft_id BIGSERIAL PRIMARY KEY,
  payment_document_ocr_import_id BIGINT NOT NULL REFERENCES accounting.payment_document_ocr_imports(payment_document_ocr_import_id),
  payment_document_sorting_draft_id BIGINT REFERENCES accounting.payment_document_sorting_drafts(payment_document_sorting_draft_id),
  specialist_analysis_id BIGINT REFERENCES accounting.payment_document_specialist_analysis_results(specialist_analysis_id) ON DELETE SET NULL,
  draft_no TEXT NOT NULL DEFAULT '',
  draft_version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  draft_status TEXT NOT NULL DEFAULT 'draft',
  human_check_status TEXT NOT NULL DEFAULT 'unchecked',
  customer_number TEXT NOT NULL DEFAULT '',
  supply_point_number TEXT NOT NULL DEFAULT '',
  meter_reading_date DATE,
  usage_quantity NUMERIC,
  usage_unit TEXT NOT NULL DEFAULT '',
  specialist_fields_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  visible_fields_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  human_corrections_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by_page TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_utility_drafts_specialist_analysis_id
ON accounting.payment_document_utility_communication_drafts(specialist_analysis_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_utility_drafts_current_ocr
ON accounting.payment_document_utility_communication_drafts(payment_document_ocr_import_id)
WHERE is_current=TRUE AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_utility_drafts_current_sorting
ON accounting.payment_document_utility_communication_drafts(payment_document_sorting_draft_id)
WHERE payment_document_sorting_draft_id IS NOT NULL
AND is_current=TRUE AND deleted_at IS NULL;

COMMIT;