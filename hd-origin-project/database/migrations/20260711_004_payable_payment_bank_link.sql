BEGIN;

SET client_encoding TO 'UTF8';

ALTER TABLE accounting.payable_payments
  ADD COLUMN IF NOT EXISTS company_id BIGINT,
  ADD COLUMN IF NOT EXISTS bank_account_id BIGINT,
  ADD COLUMN IF NOT EXISTS bank_transaction_id BIGINT,
  ADD COLUMN IF NOT EXISTS bank_source_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'payable_payments_company_fk'
      AND conrelid =
        'accounting.payable_payments'::regclass
  ) THEN
    ALTER TABLE accounting.payable_payments
      ADD CONSTRAINT payable_payments_company_fk
      FOREIGN KEY (company_id)
      REFERENCES expenses.companies(company_id)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'payable_payments_company_bank_account_fk'
      AND conrelid =
        'accounting.payable_payments'::regclass
  ) THEN
    ALTER TABLE accounting.payable_payments
      ADD CONSTRAINT
        payable_payments_company_bank_account_fk
      FOREIGN KEY (
        company_id,
        bank_account_id
      )
      REFERENCES accounting.bank_accounts (
        company_id,
        bank_account_id
      )
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'payable_payments_bank_transaction_fk'
      AND conrelid =
        'accounting.payable_payments'::regclass
  ) THEN
    ALTER TABLE accounting.payable_payments
      ADD CONSTRAINT
        payable_payments_bank_transaction_fk
      FOREIGN KEY (bank_transaction_id)
      REFERENCES accounting.bank_transactions(
        bank_transaction_id
      )
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
  ux_payable_payments_bank_transaction_id
ON accounting.payable_payments(
  bank_transaction_id
)
WHERE bank_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
  ux_payable_payments_bank_source_key
ON accounting.payable_payments(
  bank_source_key
)
WHERE bank_source_key IS NOT NULL
  AND bank_source_key <> '';

CREATE INDEX IF NOT EXISTS
  ix_payable_payments_company_bank_account
ON accounting.payable_payments(
  company_id,
  bank_account_id,
  payment_date,
  payable_payment_id
);

COMMENT ON COLUMN
  accounting.payable_payments.company_id
IS
  '支払会社。expenses.companies.company_id';

COMMENT ON COLUMN
  accounting.payable_payments.bank_account_id
IS
  '実際に支払った銀行口座';

COMMENT ON COLUMN
  accounting.payable_payments.bank_transaction_id
IS
  '支払登録により作成された銀行出金明細';

COMMENT ON COLUMN
  accounting.payable_payments.bank_source_key
IS
  '銀行明細二重作成防止キー';

DO $$
DECLARE
  company_column_count INTEGER;
  account_column_count INTEGER;
  transaction_column_count INTEGER;
  source_key_column_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO company_column_count
  FROM information_schema.columns
  WHERE table_schema = 'accounting'
    AND table_name = 'payable_payments'
    AND column_name = 'company_id';

  SELECT COUNT(*)
  INTO account_column_count
  FROM information_schema.columns
  WHERE table_schema = 'accounting'
    AND table_name = 'payable_payments'
    AND column_name = 'bank_account_id';

  SELECT COUNT(*)
  INTO transaction_column_count
  FROM information_schema.columns
  WHERE table_schema = 'accounting'
    AND table_name = 'payable_payments'
    AND column_name = 'bank_transaction_id';

  SELECT COUNT(*)
  INTO source_key_column_count
  FROM information_schema.columns
  WHERE table_schema = 'accounting'
    AND table_name = 'payable_payments'
    AND column_name = 'bank_source_key';

  IF company_column_count <> 1 THEN
    RAISE EXCEPTION
      'company_id列の確認に失敗しました。件数=%',
      company_column_count;
  END IF;

  IF account_column_count <> 1 THEN
    RAISE EXCEPTION
      'bank_account_id列の確認に失敗しました。件数=%',
      account_column_count;
  END IF;

  IF transaction_column_count <> 1 THEN
    RAISE EXCEPTION
      'bank_transaction_id列の確認に失敗しました。件数=%',
      transaction_column_count;
  END IF;

  IF source_key_column_count <> 1 THEN
    RAISE EXCEPTION
      'bank_source_key列の確認に失敗しました。件数=%',
      source_key_column_count;
  END IF;
END
$$;

COMMIT;