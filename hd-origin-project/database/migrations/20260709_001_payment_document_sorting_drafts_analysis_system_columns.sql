-- HD Origin Project
-- 支払書類仕分け下書き analysis_system_* 列追加
-- GPT側作業。GPT2側未使用。
-- 目的:
--   税金・公的支払専門AIが返す analysis_system_code / label / reason / confidence を
--   payment_document_sorting_drafts に保存できるようにする。
-- 注意:
--   AI判定値の後付け補正ではない。保存先の器を追加するだけ。

ALTER TABLE accounting.payment_document_sorting_drafts
  ADD COLUMN IF NOT EXISTS analysis_system_code text,
  ADD COLUMN IF NOT EXISTS analysis_system_label text,
  ADD COLUMN IF NOT EXISTS analysis_system_reason text,
  ADD COLUMN IF NOT EXISTS analysis_system_confidence text;

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.analysis_system_code IS
  'AI専門解析システムコード。例: tax_public_analysis。';

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.analysis_system_label IS
  'AI専門解析システム名。例: 税金・公的支払解析システム。';

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.analysis_system_reason IS
  'AIが専門解析システムを選んだ理由。';

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.analysis_system_confidence IS
  'AI専門解析システム判定の信頼度。高/中/低。';
