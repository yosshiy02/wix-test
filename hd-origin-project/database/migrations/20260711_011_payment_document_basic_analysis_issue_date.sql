-- HD_ORIGIN_BASIC_ANALYSIS_ISSUE_DATE_COLUMN_20260711
-- Add issue_date for basic analysis.
-- issue_date means document issue date.
-- issue_date is not due date, tax due date, payment date, contract period, insurance period, usage period, target period, or closing date.

ALTER TABLE accounting.payment_document_sorting_drafts
  ADD COLUMN IF NOT EXISTS issue_date date;

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.issue_date
  IS 'Basic analysis issue date. Not due date, tax due date, payment date, contract period, insurance period, usage period, target period, or closing date.';