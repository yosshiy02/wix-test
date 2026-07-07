SELECT
  'current_sorting_drafts' AS check_name,
  COUNT(*) AS count
FROM accounting.payment_document_sorting_drafts
WHERE is_current = TRUE
  AND deleted_at IS NULL;

SELECT
  'ocr_imports_draft_saved' AS check_name,
  COUNT(*) AS count
FROM accounting.payment_document_ocr_imports
WHERE draft_status = 'draft_saved'
  AND latest_sorting_draft_id IS NOT NULL
  AND deleted_at IS NULL;

SELECT
  d.payment_document_sorting_draft_id,
  d.payment_document_ocr_import_id,
  d.draft_status,
  d.human_check_status,
  d.is_current,
  d.document_type_code,
  d.document_type_label,
  d.payment_destination_code,
  d.payment_destination_label,
  d.specialist_route_code,
  d.specialist_route_label,
  d.ai_confidence_label,
  d.needs_review,
  d.original_file_name,
  d.ocr_text_length,
  d.created_at,
  o.draft_status AS ocr_draft_status,
  o.latest_sorting_draft_id,
  o.sorted_at
FROM accounting.payment_document_sorting_drafts d
JOIN accounting.payment_document_ocr_imports o
  ON o.payment_document_ocr_import_id = d.payment_document_ocr_import_id
WHERE d.is_current = TRUE
  AND d.deleted_at IS NULL
ORDER BY d.payment_document_sorting_draft_id DESC
LIMIT 30;

SELECT
  o.payment_document_ocr_import_id,
  o.original_file_name,
  o.ocr_status,
  o.ocr_text_length,
  o.draft_status,
  o.latest_sorting_draft_id,
  o.sorted_at,
  d.payment_document_sorting_draft_id,
  d.document_type_label,
  d.payment_destination_label,
  d.created_at AS draft_created_at
FROM accounting.payment_document_ocr_imports o
LEFT JOIN accounting.payment_document_sorting_drafts d
  ON d.payment_document_sorting_draft_id = o.latest_sorting_draft_id
WHERE o.deleted_at IS NULL
ORDER BY o.payment_document_ocr_import_id DESC
LIMIT 30;
