DROP TRIGGER IF EXISTS trg_payment_document_sorting_drafts_updated_at
  ON accounting.payment_document_sorting_drafts;

DROP FUNCTION IF EXISTS accounting.set_payment_document_sorting_drafts_updated_at();

DROP TABLE IF EXISTS accounting.payment_document_sorting_drafts;

ALTER TABLE accounting.payment_document_ocr_imports
  DROP COLUMN IF EXISTS latest_sorting_draft_id;

ALTER TABLE accounting.payment_document_ocr_imports
  DROP COLUMN IF EXISTS sorted_at;

-- draft_status は既存コード参照の可能性があるため削除しない。
