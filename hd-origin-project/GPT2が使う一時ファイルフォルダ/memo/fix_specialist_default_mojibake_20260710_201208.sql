BEGIN;

ALTER TABLE accounting.payment_document_sorting_drafts
  ALTER COLUMN specialist_analysis_status SET DEFAULT U&'\672A\89E3\6790';

ALTER TABLE accounting.payment_document_specialist_analysis_results
  ALTER COLUMN specialist_analysis_status SET DEFAULT U&'\4FDD\5B58\6E08\307F',
  ALTER COLUMN human_confirm_status SET DEFAULT U&'\672A\78BA\8A8D';

UPDATE accounting.payment_document_sorting_drafts
SET specialist_analysis_status = U&'\672A\89E3\6790'
WHERE specialist_analysis_status IS NULL
   OR specialist_analysis_status = '譛ｪ隗｣譫・';

UPDATE accounting.payment_document_specialist_analysis_results
SET specialist_analysis_status = U&'\4FDD\5B58\6E08\307F'
WHERE specialist_analysis_status IS NULL
   OR specialist_analysis_status = '菫晏ｭ俶ｸ医∩';

UPDATE accounting.payment_document_specialist_analysis_results
SET human_confirm_status = U&'\672A\78BA\8A8D'
WHERE human_confirm_status IS NULL
   OR human_confirm_status = '譛ｪ遒ｺ隱・';

COMMIT;

SELECT
  table_name,
  column_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'accounting'
  AND (
    (table_name = 'payment_document_sorting_drafts' AND column_name = 'specialist_analysis_status')
    OR
    (table_name = 'payment_document_specialist_analysis_results' AND column_name IN ('specialist_analysis_status','human_confirm_status'))
  )
ORDER BY table_name, column_name;