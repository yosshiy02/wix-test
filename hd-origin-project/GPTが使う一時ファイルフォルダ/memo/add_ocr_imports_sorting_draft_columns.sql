ALTER TABLE accounting.payment_document_ocr_imports
  ADD COLUMN IF NOT EXISTS draft_status TEXT NOT NULL DEFAULT '';

ALTER TABLE accounting.payment_document_ocr_imports
  ADD COLUMN IF NOT EXISTS latest_sorting_draft_id BIGINT;

ALTER TABLE accounting.payment_document_ocr_imports
  ADD COLUMN IF NOT EXISTS sorted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payment_document_ocr_imports_latest_sorting_draft
  ON accounting.payment_document_ocr_imports(latest_sorting_draft_id);

SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'accounting'
  AND table_name = 'payment_document_ocr_imports'
  AND column_name IN ('draft_status', 'latest_sorting_draft_id', 'sorted_at')
ORDER BY column_name;
