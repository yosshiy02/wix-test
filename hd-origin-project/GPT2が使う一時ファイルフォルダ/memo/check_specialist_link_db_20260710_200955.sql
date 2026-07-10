SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'accounting'
  AND table_name = 'payment_document_sorting_drafts'
  AND column_name IN (
    'latest_specialist_analysis_id',
    'specialist_analysis_status',
    'specialist_analyzed_at',
    'specialist_saved_at',
    'specialist_error_text'
  )
ORDER BY column_name;

SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'accounting'
  AND table_name = 'payment_document_specialist_analysis_results';

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'accounting'
  AND table_name = 'payment_document_specialist_analysis_results'
ORDER BY ordinal_position;