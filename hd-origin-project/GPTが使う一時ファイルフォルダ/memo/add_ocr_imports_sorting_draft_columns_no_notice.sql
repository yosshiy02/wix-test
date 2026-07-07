DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'payment_document_ocr_imports'
      AND column_name = 'draft_status'
  ) THEN
    ALTER TABLE accounting.payment_document_ocr_imports
      ADD COLUMN draft_status TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'payment_document_ocr_imports'
      AND column_name = 'latest_sorting_draft_id'
  ) THEN
    ALTER TABLE accounting.payment_document_ocr_imports
      ADD COLUMN latest_sorting_draft_id BIGINT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'payment_document_ocr_imports'
      AND column_name = 'sorted_at'
  ) THEN
    ALTER TABLE accounting.payment_document_ocr_imports
      ADD COLUMN sorted_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'accounting'
      AND indexname = 'idx_payment_document_ocr_imports_latest_sorting_draft'
  ) THEN
    CREATE INDEX idx_payment_document_ocr_imports_latest_sorting_draft
      ON accounting.payment_document_ocr_imports(latest_sorting_draft_id);
  END IF;
END $$;

SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'accounting'
  AND table_name = 'payment_document_ocr_imports'
  AND column_name IN ('draft_status', 'latest_sorting_draft_id', 'sorted_at')
ORDER BY column_name;
