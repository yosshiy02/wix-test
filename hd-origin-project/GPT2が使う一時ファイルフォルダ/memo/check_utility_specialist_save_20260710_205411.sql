\echo === latest utility specialist analysis results ===

SELECT
  sar.specialist_analysis_id,
  sar.payment_document_ocr_import_id,
  sar.payment_document_sorting_draft_id,
  sar.analysis_system_code,
  sar.analysis_system_label,
  sar.specialist_analysis_status,
  sar.is_current,
  sar.created_at,
  sar.updated_at,
  LEFT(COALESCE(sar.ai_reason, ''), 120) AS ai_reason_head
FROM accounting.payment_document_specialist_analysis_results sar
WHERE sar.analysis_system_code IN (
  'utility_communication',
  'public_utility',
  'utility',
  'communication',
  '公共料金・通信費'
)
   OR sar.analysis_system_label LIKE '%公共%'
   OR sar.analysis_system_label LIKE '%通信%'
ORDER BY sar.specialist_analysis_id DESC
LIMIT 20;

\echo === parent sorting drafts linked to latest specialist analysis ===

SELECT
  sd.payment_document_sorting_draft_id,
  sd.payment_document_ocr_import_id,
  sd.analysis_system_code,
  sd.analysis_system_label,
  sd.specialist_analysis_status,
  sd.latest_specialist_analysis_id,
  sd.specialist_analyzed_at,
  sd.specialist_saved_at,
  sd.updated_at
FROM accounting.payment_document_sorting_drafts sd
WHERE sd.latest_specialist_analysis_id IS NOT NULL
ORDER BY sd.updated_at DESC
LIMIT 20;

\echo === newest raw specialist payload summary ===

SELECT
  sar.specialist_analysis_id,
  sar.analysis_system_code,
  sar.analysis_system_label,
  jsonb_pretty(sar.raw_result_json) AS raw_result_json
FROM accounting.payment_document_specialist_analysis_results sar
WHERE sar.analysis_system_code IN (
  'utility_communication',
  'public_utility',
  'utility',
  'communication',
  '公共料金・通信費'
)
   OR sar.analysis_system_label LIKE '%公共%'
   OR sar.analysis_system_label LIKE '%通信%'
ORDER BY sar.specialist_analysis_id DESC
LIMIT 1;