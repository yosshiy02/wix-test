BEGIN;

ALTER TABLE accounting.payment_document_sorting_drafts
  ADD COLUMN IF NOT EXISTS latest_specialist_analysis_id BIGINT,
  ADD COLUMN IF NOT EXISTS specialist_analysis_status TEXT DEFAULT '未解析',
  ADD COLUMN IF NOT EXISTS specialist_analyzed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS specialist_saved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS specialist_error_text TEXT;

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.latest_specialist_analysis_id
  IS 'この1回目・2回目解析結果に対応する最新の専門解析ID';

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.specialist_analysis_status
  IS '専門解析状態。未解析、解析中、解析済み、保存済み、対象外、要確認、エラー等';

CREATE TABLE IF NOT EXISTS accounting.payment_document_specialist_analysis_results (
  specialist_analysis_id BIGSERIAL PRIMARY KEY,

  payment_document_ocr_import_id BIGINT NOT NULL
    REFERENCES accounting.payment_document_ocr_imports(payment_document_ocr_import_id)
    ON DELETE CASCADE,

  payment_document_sorting_draft_id BIGINT NOT NULL
    REFERENCES accounting.payment_document_sorting_drafts(payment_document_sorting_draft_id)
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
  IS '支払書類の専門解析結果。1回目・2回目解析結果 payment_document_sorting_draft_id にぶら下がる。';

CREATE INDEX IF NOT EXISTS idx_pd_specialist_results_ocr
  ON accounting.payment_document_specialist_analysis_results(payment_document_ocr_import_id);

CREATE INDEX IF NOT EXISTS idx_pd_specialist_results_sorting
  ON accounting.payment_document_specialist_analysis_results(payment_document_sorting_draft_id);

CREATE INDEX IF NOT EXISTS idx_pd_specialist_results_system
  ON accounting.payment_document_specialist_analysis_results(analysis_system_code);

CREATE INDEX IF NOT EXISTS idx_pd_specialist_results_current
  ON accounting.payment_document_specialist_analysis_results(payment_document_sorting_draft_id, analysis_system_code, is_current);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pd_specialist_results_current
  ON accounting.payment_document_specialist_analysis_results(payment_document_sorting_draft_id, analysis_system_code)
  WHERE is_current = TRUE AND deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_pd_sorting_latest_specialist_analysis'
  ) THEN
    ALTER TABLE accounting.payment_document_sorting_drafts
      ADD CONSTRAINT fk_pd_sorting_latest_specialist_analysis
      FOREIGN KEY (latest_specialist_analysis_id)
      REFERENCES accounting.payment_document_specialist_analysis_results(specialist_analysis_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pd_sorting_latest_specialist
  ON accounting.payment_document_sorting_drafts(latest_specialist_analysis_id);

CREATE INDEX IF NOT EXISTS idx_pd_sorting_specialist_status
  ON accounting.payment_document_sorting_drafts(specialist_analysis_status);

COMMIT;