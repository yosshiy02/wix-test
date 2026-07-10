BEGIN;

ALTER TABLE accounting.payment_document_sorting_drafts
  DROP CONSTRAINT IF EXISTS fk_pd_sorting_latest_specialist_analysis;

DROP INDEX IF EXISTS accounting.idx_pd_sorting_latest_specialist;
DROP INDEX IF EXISTS accounting.idx_pd_sorting_specialist_status;
DROP INDEX IF EXISTS accounting.uq_pd_specialist_results_current;
DROP INDEX IF EXISTS accounting.idx_pd_specialist_results_current;
DROP INDEX IF EXISTS accounting.idx_pd_specialist_results_system;
DROP INDEX IF EXISTS accounting.idx_pd_specialist_results_sorting;
DROP INDEX IF EXISTS accounting.idx_pd_specialist_results_ocr;

DROP TABLE IF EXISTS accounting.payment_document_specialist_analysis_results;

ALTER TABLE accounting.payment_document_sorting_drafts
  DROP COLUMN IF EXISTS latest_specialist_analysis_id,
  DROP COLUMN IF EXISTS specialist_analysis_status,
  DROP COLUMN IF EXISTS specialist_analyzed_at,
  DROP COLUMN IF EXISTS specialist_saved_at,
  DROP COLUMN IF EXISTS specialist_error_text;

COMMIT;
