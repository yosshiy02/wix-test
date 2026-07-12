BEGIN;

CREATE TABLE IF NOT EXISTS accounting.withholding_tax_ledger (
  withholding_tax_ledger_id BIGSERIAL PRIMARY KEY,

  company_id BIGINT NOT NULL
    REFERENCES expenses.companies(company_id),

  payable_id BIGINT NOT NULL
    REFERENCES accounting.payable_documents(payable_id),

  payable_payment_id BIGINT NULL
    REFERENCES accounting.payable_payments(payable_payment_id)
    ON DELETE SET NULL,

  recognition_date DATE NOT NULL,

  counterparty_name TEXT NOT NULL DEFAULT '',

  withholding_tax_amount NUMERIC(14,2)
    NOT NULL DEFAULT 0,

  currency_code TEXT NOT NULL DEFAULT 'JPY',

  status_code TEXT NOT NULL DEFAULT 'active',
  status_name TEXT NOT NULL DEFAULT '預り中',

  source_type_code TEXT
    NOT NULL DEFAULT 'payable_payment',

  source_reference TEXT NOT NULL DEFAULT '',
  source_key TEXT NOT NULL,

  tax_payment_reference TEXT NOT NULL DEFAULT '',
  paid_at DATE NULL,
  cancelled_at TIMESTAMPTZ NULL,

  memo TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT withholding_tax_ledger_amount_chk
    CHECK (withholding_tax_amount > 0),

  CONSTRAINT withholding_tax_ledger_status_chk
    CHECK (
      status_code IN (
        'active',
        'paid',
        'cancelled'
      )
    ),

  CONSTRAINT withholding_tax_ledger_source_key_uk
    UNIQUE (source_key)
);

CREATE INDEX IF NOT EXISTS
  withholding_tax_ledger_company_date_idx
ON accounting.withholding_tax_ledger (
  company_id,
  recognition_date,
  withholding_tax_ledger_id
);

CREATE INDEX IF NOT EXISTS
  withholding_tax_ledger_payable_idx
ON accounting.withholding_tax_ledger(payable_id);

CREATE INDEX IF NOT EXISTS
  withholding_tax_ledger_payment_idx
ON accounting.withholding_tax_ledger(
  payable_payment_id
);

DROP TRIGGER IF EXISTS
  trg_withholding_tax_ledger_updated_at
ON accounting.withholding_tax_ledger;

CREATE TRIGGER
  trg_withholding_tax_ledger_updated_at
BEFORE UPDATE
ON accounting.withholding_tax_ledger
FOR EACH ROW
EXECUTE FUNCTION accounting.set_updated_at();

CREATE OR REPLACE VIEW
  accounting.v_withholding_tax_ledger
AS
SELECT
  w.withholding_tax_ledger_id,
  w.company_id,
  c.company_code,
  c.company_name,
  w.payable_id,
  d.payable_no,
  d.vendor_name AS payable_vendor_name,
  w.payable_payment_id,
  w.recognition_date,
  w.counterparty_name,
  w.withholding_tax_amount,
  w.currency_code,
  w.status_code,
  w.status_name,
  w.source_type_code,
  w.source_reference,
  w.source_key,
  w.tax_payment_reference,
  w.paid_at,
  w.cancelled_at,
  w.memo,
  w.created_at,
  w.updated_at
FROM accounting.withholding_tax_ledger w
JOIN expenses.companies c
  ON c.company_id = w.company_id
JOIN accounting.payable_documents d
  ON d.payable_id = w.payable_id;

COMMIT;