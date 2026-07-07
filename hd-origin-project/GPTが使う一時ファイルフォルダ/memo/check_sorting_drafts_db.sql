SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'accounting'
  AND table_name = 'payment_document_sorting_drafts';

SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'accounting'
  AND table_name = 'payment_document_sorting_drafts'
ORDER BY ordinal_position;
