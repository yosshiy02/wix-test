BEGIN;

UPDATE accounting.payment_document_sorting_drafts
SET
  public_utility_label = '対象外',
  updated_at = NOW()
WHERE deleted_at IS NULL
  AND is_current = TRUE
  AND COALESCE(public_utility_label, '') = '公共料金'
  AND COALESCE(document_type_code, '') NOT IN ('utility_notice', 'utility_bill', 'public_utility')
  AND COALESCE(document_type_label, '') NOT LIKE '%公共料金%'
  AND COALESCE(document_type_label, '') NOT LIKE '%水道料金%'
  AND COALESCE(document_type_label, '') NOT LIKE '%電気料金%'
  AND COALESCE(document_type_label, '') NOT LIKE '%ガス料金%'
  AND COALESCE(document_type_label, '') NOT LIKE '%通信費%';

SELECT
  payment_document_sorting_draft_id,
  payment_document_ocr_import_id,
  document_type_label,
  payment_destination_label,
  accounting_category_label,
  payable_kind_label,
  specialist_route_label,
  public_utility_label,
  ai_reason
FROM accounting.payment_document_sorting_drafts
WHERE deleted_at IS NULL
  AND is_current = TRUE
ORDER BY payment_document_ocr_import_id;

COMMIT;
