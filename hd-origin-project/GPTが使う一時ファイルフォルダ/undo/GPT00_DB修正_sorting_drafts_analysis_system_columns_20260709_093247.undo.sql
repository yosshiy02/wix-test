-- 手動UNDO用。通常は実行しないでください。
-- analysis_system_* 列を消すと、仕分け下書き保存APIがまた失敗します。

ALTER TABLE accounting.payment_document_sorting_drafts
  DROP COLUMN IF EXISTS analysis_system_code,
  DROP COLUMN IF EXISTS analysis_system_label,
  DROP COLUMN IF EXISTS analysis_system_reason,
  DROP COLUMN IF EXISTS analysis_system_confidence;
