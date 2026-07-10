\echo === recent sorting drafts ===

SELECT
  sd.payment_document_sorting_draft_id,
  sd.payment_document_ocr_import_id,
  sd.document_type,
  sd.processing_target,
  sd.accounting_category,
  sd.analysis_system_code,
  sd.analysis_system_label,
  sd.specialist_route_code,
  sd.specialist_route_label,
  sd.specialist_analysis_status,
  sd.latest_specialist_analysis_id,
  sd.is_current,
  sd.created_at,
  sd.updated_at,
  LEFT(COALESCE(sd.ai_reason, ''), 120) AS ai_reason_head
FROM accounting.payment_document_sorting_drafts sd
WHERE sd.deleted_at IS NULL
ORDER BY sd.updated_at DESC, sd.payment_document_sorting_draft_id DESC
LIMIT 30;

\echo === utility-looking sorting drafts ===

SELECT
  sd.payment_document_sorting_draft_id,
  sd.payment_document_ocr_import_id,
  sd.document_type,
  sd.processing_target,
  sd.analysis_system_code,
  sd.analysis_system_label,
  sd.specialist_route_code,
  sd.specialist_route_label,
  sd.specialist_analysis_status,
  sd.latest_specialist_analysis_id,
  sd.is_current,
  sd.created_at,
  sd.updated_at
FROM accounting.payment_document_sorting_drafts sd
WHERE sd.deleted_at IS NULL
  AND (
    COALESCE(sd.analysis_system_code, '') ILIKE '%utility%'
    OR COALESCE(sd.analysis_system_code, '') ILIKE '%communication%'
    OR COALESCE(sd.analysis_system_label, '') LIKE '%公共%'
    OR COALESCE(sd.analysis_system_label, '') LIKE '%通信%'
    OR COALESCE(sd.specialist_route_code, '') ILIKE '%utility%'
    OR COALESCE(sd.specialist_route_code, '') ILIKE '%communication%'
    OR COALESCE(sd.specialist_route_label, '') LIKE '%公共%'
    OR COALESCE(sd.specialist_route_label, '') LIKE '%通信%'
    OR COALESCE(sd.document_type, '') LIKE '%公共%'
    OR COALESCE(sd.document_type, '') LIKE '%通信%'
    OR COALESCE(sd.document_type, '') LIKE '%水道%'
    OR COALESCE(sd.document_type, '') LIKE '%電気%'
    OR COALESCE(sd.document_type, '') LIKE '%ガス%'
  )
ORDER BY sd.updated_at DESC, sd.payment_document_sorting_draft_id DESC
LIMIT 30;