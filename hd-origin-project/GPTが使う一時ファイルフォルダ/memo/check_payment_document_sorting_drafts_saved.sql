SELECT
  COUNT(*) AS sorting_draft_count
FROM accounting.payment_document_sorting_drafts
WHERE deleted_at IS NULL;

SELECT
  payment_document_sorting_draft_id,
  payment_document_ocr_import_id,
  draft_no,
  draft_status,
  is_current,
  document_type_code,
  document_type_label,
  payment_destination_code,
  payment_destination_label,
  accounting_category_code,
  accounting_category_label,
  ai_confidence_label,
  ai_reason,
  display_rotation,
  created_at,
  updated_at
FROM accounting.payment_document_sorting_drafts
WHERE deleted_at IS NULL
ORDER BY payment_document_sorting_draft_id DESC
LIMIT 20;

SELECT
  payment_document_ocr_import_id,
  original_file_name,
  draft_status,
  latest_sorting_draft_id,
  sorted_at
FROM accounting.payment_document_ocr_imports
WHERE payment_document_ocr_import_id IN (10, 11)
ORDER BY payment_document_ocr_import_id;
