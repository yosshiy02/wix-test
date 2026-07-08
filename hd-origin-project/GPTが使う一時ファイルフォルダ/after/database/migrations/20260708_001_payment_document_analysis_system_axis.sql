BEGIN;

ALTER TABLE accounting.payment_document_sorting_drafts
  ADD COLUMN IF NOT EXISTS analysis_system_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS analysis_system_label VARCHAR(160),
  ADD COLUMN IF NOT EXISTS analysis_system_reason TEXT,
  ADD COLUMN IF NOT EXISTS analysis_system_confidence VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_payment_document_sorting_drafts_analysis_system_code
  ON accounting.payment_document_sorting_drafts (analysis_system_code)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.analysis_system_code IS
  '1回目AI仕分けで判定した専門解析システムコード。会計分類ではなく専門解析ルート。';

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.analysis_system_label IS
  '1回目AI仕分けで判定した専門解析システム表示名。';

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.analysis_system_reason IS
  '専門解析システムへ送る理由。';

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.analysis_system_confidence IS
  '専門解析システム判定の信頼度。高・中・低など。';

COMMIT;