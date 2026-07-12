BEGIN;

ALTER TABLE accounting.withholding_tax_ledger
  ADD COLUMN IF NOT EXISTS tax_item_code TEXT
    NOT NULL DEFAULT 'withholding_income_tax',

  ADD COLUMN IF NOT EXISTS tax_item_name TEXT
    NOT NULL DEFAULT '源泉所得税',

  ADD COLUMN IF NOT EXISTS tax_public_status_code TEXT
    NOT NULL DEFAULT 'candidate',

  ADD COLUMN IF NOT EXISTS tax_public_due_date DATE NULL,

  ADD COLUMN IF NOT EXISTS tax_public_source_key TEXT
    NOT NULL DEFAULT '',

  ADD COLUMN IF NOT EXISTS tax_public_registered_at
    TIMESTAMPTZ NULL,

  ADD COLUMN IF NOT EXISTS tax_public_paid_at
    TIMESTAMPTZ NULL;

UPDATE accounting.withholding_tax_ledger
SET
  tax_public_source_key =
    'WITHHOLDING_TAX_LEDGER:' ||
    withholding_tax_ledger_id::TEXT
WHERE COALESCE(tax_public_source_key, '') = '';

ALTER TABLE accounting.withholding_tax_ledger
  DROP CONSTRAINT IF EXISTS
    withholding_tax_ledger_tax_public_status_chk;

ALTER TABLE accounting.withholding_tax_ledger
  ADD CONSTRAINT
    withholding_tax_ledger_tax_public_status_chk
  CHECK (
    tax_public_status_code IN (
      'candidate',
      'scheduled',
      'paid',
      'cancelled'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS
  withholding_tax_ledger_tax_public_source_key_uk
ON accounting.withholding_tax_ledger (
  tax_public_source_key
)
WHERE tax_public_source_key <> '';

CREATE INDEX IF NOT EXISTS
  withholding_tax_ledger_tax_public_status_idx
ON accounting.withholding_tax_ledger (
  company_id,
  tax_public_status_code,
  tax_public_due_date,
  recognition_date
);

CREATE OR REPLACE VIEW
  accounting.v_tax_public_withholding_candidates
AS
SELECT
  w.withholding_tax_ledger_id,

  w.company_id,
  c.company_code,
  c.company_name,

  w.payable_id,
  w.payable_payment_id,

  w.tax_item_code,
  w.tax_item_name,

  w.recognition_date,
  w.tax_public_due_date,

  w.counterparty_name,
  w.withholding_tax_amount AS payment_amount,
  w.currency_code,

  w.tax_public_status_code,
  w.tax_public_source_key,

  'withholding_tax_ledger'::TEXT
    AS source_type_code,

  '源泉預り金台帳'::TEXT
    AS source_type_name,

  w.source_reference,
  w.memo,

  w.created_at,
  w.updated_at

FROM accounting.withholding_tax_ledger w

JOIN expenses.companies c
  ON c.company_id = w.company_id

WHERE
  w.status_code = 'active'
  AND w.tax_public_status_code IN (
    'candidate',
    'scheduled'
  )
  AND w.withholding_tax_amount > 0;

COMMENT ON VIEW
  accounting.v_tax_public_withholding_candidates
IS
  '源泉預り金台帳から税金・公的支払へ自動連携する納付候補';

COMMIT;