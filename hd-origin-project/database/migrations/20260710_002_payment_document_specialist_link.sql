BEGIN;

CREATE TABLE IF NOT EXISTS accounting.payment_document_specialist_analysis_results (
  specialist_analysis_id BIGSERIAL PRIMARY KEY,

  payment_document_ocr_import_id BIGINT NOT NULL
    REFERENCES accounting.payment_document_ocr_imports(payment_document_ocr_import_id)
    ON DELETE CASCADE,

  analysis_system_code TEXT NOT NULL,
  analysis_system_label TEXT,

  specialist_analysis_status TEXT DEFAULT '保存済み',

  ai_confidence NUMERIC(5,2),
  ai_reason TEXT,
  warnings_json JSONB,
  raw_result_json JSONB,

  human_confirm_status TEXT DEFAULT '未確認',
  human_memo TEXT,

  is_current BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE accounting.payment_document_specialist_analysis_results
  IS 'OCR取込証憑に直接紐づく正式な専門解析結果';

ALTER TABLE accounting.payment_document_ocr_imports
  ADD COLUMN IF NOT EXISTS latest_specialist_analysis_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_pd_ocr_latest_specialist_analysis'
  ) THEN
    ALTER TABLE accounting.payment_document_ocr_imports
      ADD CONSTRAINT fk_pd_ocr_latest_specialist_analysis
      FOREIGN KEY (latest_specialist_analysis_id)
      REFERENCES accounting.payment_document_specialist_analysis_results(specialist_analysis_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pd_specialist_results_ocr
  ON accounting.payment_document_specialist_analysis_results(
    payment_document_ocr_import_id
  );

CREATE INDEX IF NOT EXISTS idx_pd_specialist_results_system
  ON accounting.payment_document_specialist_analysis_results(
    analysis_system_code
  );

CREATE INDEX IF NOT EXISTS idx_pd_specialist_results_current
  ON accounting.payment_document_specialist_analysis_results(
    payment_document_ocr_import_id,
    analysis_system_code,
    is_current
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_pd_specialist_results_current
  ON accounting.payment_document_specialist_analysis_results(
    payment_document_ocr_import_id,
    analysis_system_code
  )
  WHERE is_current = TRUE
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pd_ocr_latest_specialist
  ON accounting.payment_document_ocr_imports(
    latest_specialist_analysis_id
  );

COMMIT;