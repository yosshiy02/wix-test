BEGIN;

CREATE TABLE IF NOT EXISTS
  accounting.tax_public_obligations (
    tax_public_obligation_id
      BIGSERIAL PRIMARY KEY,

    company_id
      BIGINT NOT NULL,

    source_type_code
      TEXT NOT NULL,

    source_key
      TEXT NOT NULL,

    tax_item_code
      TEXT NOT NULL,

    tax_item_name
      TEXT NOT NULL,

    source_ledger_id
      BIGINT NULL,

    payable_id
      BIGINT NULL,

    payable_payment_id
      BIGINT NULL,

    counterparty_name
      TEXT NULL,

    recognition_date
      DATE NOT NULL,

    due_date
      DATE NULL,

    payment_amount
      NUMERIC(18, 2) NOT NULL,

    currency_code
      TEXT NOT NULL DEFAULT 'JPY',

    status_code
      TEXT NOT NULL DEFAULT 'scheduled',

    scheduled_at
      TIMESTAMPTZ NULL,

    paid_at
      TIMESTAMPTZ NULL,

    paid_reference
      TEXT NULL,

    machine_validation_status
      TEXT NOT NULL DEFAULT 'valid',

    machine_validation_message
      TEXT NULL,

    created_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT
      tax_public_obligations_amount_chk
    CHECK (
      payment_amount > 0
    ),

    CONSTRAINT
      tax_public_obligations_status_chk
    CHECK (
      status_code IN (
        'scheduled',
        'paid',
        'cancelled',
        'error'
      )
    ),

    CONSTRAINT
      tax_public_obligations_validation_chk
    CHECK (
      machine_validation_status IN (
        'valid',
        'warning',
        'error'
      )
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS
  tax_public_obligations_source_uk
ON accounting.tax_public_obligations (
  source_type_code,
  source_key
);

CREATE INDEX IF NOT EXISTS
  tax_public_obligations_company_status_idx
ON accounting.tax_public_obligations (
  company_id,
  status_code,
  due_date,
  recognition_date
);

CREATE OR REPLACE FUNCTION
  accounting.set_tax_public_obligation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  trg_tax_public_obligation_updated_at
ON accounting.tax_public_obligations;

CREATE TRIGGER
  trg_tax_public_obligation_updated_at
BEFORE UPDATE
ON accounting.tax_public_obligations
FOR EACH ROW
EXECUTE FUNCTION
  accounting.set_tax_public_obligation_updated_at();

CREATE OR REPLACE FUNCTION
  accounting.sync_withholding_ledger_from_tax_public()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF
    NEW.source_type_code = 'withholding_tax_ledger'
    AND NEW.source_ledger_id IS NOT NULL
  THEN
    UPDATE accounting.withholding_tax_ledger
    SET
      tax_public_status_code =
        CASE
          WHEN NEW.status_code = 'paid'
            THEN 'paid'
          WHEN NEW.status_code = 'cancelled'
            THEN 'cancelled'
          ELSE 'scheduled'
        END,

      tax_public_due_date =
        COALESCE(
          NEW.due_date,
          tax_public_due_date
        ),

      tax_public_registered_at =
        COALESCE(
          tax_public_registered_at,
          NEW.scheduled_at,
          NOW()
        ),

      tax_public_paid_at =
        CASE
          WHEN NEW.status_code = 'paid'
            THEN COALESCE(
              NEW.paid_at,
              NOW()
            )
          ELSE tax_public_paid_at
        END,

      updated_at = NOW()

    WHERE
      withholding_tax_ledger_id =
        NEW.source_ledger_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  trg_sync_withholding_ledger_from_tax_public
ON accounting.tax_public_obligations;

CREATE TRIGGER
  trg_sync_withholding_ledger_from_tax_public
AFTER INSERT OR UPDATE
ON accounting.tax_public_obligations
FOR EACH ROW
EXECUTE FUNCTION
  accounting.sync_withholding_ledger_from_tax_public();

CREATE OR REPLACE FUNCTION
  accounting.register_withholding_tax_obligations()
RETURNS TABLE (
  inserted_count INTEGER,
  updated_count INTEGER,
  error_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  INSERT INTO accounting.tax_public_obligations (
    company_id,
    source_type_code,
    source_key,
    tax_item_code,
    tax_item_name,
    source_ledger_id,
    payable_id,
    payable_payment_id,
    counterparty_name,
    recognition_date,
    due_date,
    payment_amount,
    currency_code,
    status_code,
    scheduled_at,
    machine_validation_status,
    machine_validation_message
  )
  SELECT
    c.company_id,
    c.source_type_code,
    c.tax_public_source_key,
    c.tax_item_code,
    c.tax_item_name,
    c.withholding_tax_ledger_id,
    c.payable_id,
    c.payable_payment_id,
    c.counterparty_name,
    c.recognition_date,
    c.tax_public_due_date,
    c.payment_amount,
    c.currency_code,
    'scheduled',
    NOW(),

    CASE
      WHEN c.company_id IS NULL
        THEN 'error'
      WHEN COALESCE(c.payment_amount, 0) <= 0
        THEN 'error'
      ELSE 'valid'
    END,

    CASE
      WHEN c.company_id IS NULL
        THEN '会社IDがありません。'
      WHEN COALESCE(c.payment_amount, 0) <= 0
        THEN '納付候補額が0以下です。'
      WHEN c.tax_public_due_date IS NULL
        THEN '納期限ルール未設定。金額と連携元は有効です。'
      ELSE NULL
    END

  FROM
    accounting.v_tax_public_withholding_candidates c

  ON CONFLICT (
    source_type_code,
    source_key
  )
  DO UPDATE SET
    company_id =
      EXCLUDED.company_id,

    tax_item_code =
      EXCLUDED.tax_item_code,

    tax_item_name =
      EXCLUDED.tax_item_name,

    source_ledger_id =
      EXCLUDED.source_ledger_id,

    payable_id =
      EXCLUDED.payable_id,

    payable_payment_id =
      EXCLUDED.payable_payment_id,

    counterparty_name =
      EXCLUDED.counterparty_name,

    recognition_date =
      EXCLUDED.recognition_date,

    due_date =
      EXCLUDED.due_date,

    payment_amount =
      EXCLUDED.payment_amount,

    currency_code =
      EXCLUDED.currency_code,

    scheduled_at =
      COALESCE(
        accounting.tax_public_obligations.scheduled_at,
        EXCLUDED.scheduled_at
      ),

    machine_validation_status =
      EXCLUDED.machine_validation_status,

    machine_validation_message =
      EXCLUDED.machine_validation_message,

    status_code =
      CASE
        WHEN accounting.tax_public_obligations.status_code =
          'paid'
        THEN 'paid'
        ELSE EXCLUDED.status_code
      END,

    updated_at = NOW();

  GET DIAGNOSTICS
    v_inserted = ROW_COUNT;

  SELECT COUNT(*)::INTEGER
  INTO v_errors
  FROM accounting.tax_public_obligations
  WHERE
    source_type_code =
      'withholding_tax_ledger'
    AND machine_validation_status =
      'error';

  RETURN QUERY
  SELECT
    v_inserted,
    v_updated,
    v_errors;
END;
$$;

CREATE OR REPLACE VIEW
  accounting.v_tax_public_obligations
AS
SELECT
  o.tax_public_obligation_id,

  o.company_id,
  c.company_code,
  c.company_name,

  o.source_type_code,
  o.source_key,

  o.tax_item_code,
  o.tax_item_name,

  o.source_ledger_id,
  o.payable_id,
  o.payable_payment_id,

  o.counterparty_name,
  o.recognition_date,
  o.due_date,

  o.payment_amount,
  o.currency_code,

  o.status_code,
  o.scheduled_at,
  o.paid_at,
  o.paid_reference,

  o.machine_validation_status,
  o.machine_validation_message,

  o.created_at,
  o.updated_at

FROM
  accounting.tax_public_obligations o

LEFT JOIN expenses.companies c
  ON c.company_id = o.company_id;

COMMENT ON TABLE
  accounting.tax_public_obligations
IS
  '税金・公的支払のシステム生成納付予定。源泉預り金等から人間の転記なしで作成する。';

COMMENT ON FUNCTION
  accounting.register_withholding_tax_obligations()
IS
  '源泉預り金台帳の候補を税金・公的支払予定へ自動登録・同期する。';

COMMIT;