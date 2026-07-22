BEGIN;

ALTER TABLE accounting.payment_document_contract_insurance_lease_drafts
  ADD COLUMN IF NOT EXISTS lease_start_date DATE,
  ADD COLUMN IF NOT EXISTS lease_end_date DATE,
  ADD COLUMN IF NOT EXISTS lease_period_months INTEGER,
  ADD COLUMN IF NOT EXISTS lease_item_location TEXT,
  ADD COLUMN IF NOT EXISTS residual_value_guarantee_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS renewal_terms TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_terms TEXT;

COMMIT;