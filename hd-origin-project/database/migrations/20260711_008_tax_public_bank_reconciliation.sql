BEGIN;

ALTER TABLE accounting.tax_public_obligations
  ADD COLUMN IF NOT EXISTS
    bank_transaction_id BIGINT NULL,

  ADD COLUMN IF NOT EXISTS
    bank_reconciliation_status_code TEXT
      NOT NULL DEFAULT 'unmatched',

  ADD COLUMN IF NOT EXISTS
    bank_reconciliation_message TEXT NULL,

  ADD COLUMN IF NOT EXISTS
    bank_matched_at TIMESTAMPTZ NULL,

  ADD COLUMN IF NOT EXISTS
    bank_match_score INTEGER
      NOT NULL DEFAULT 0;

ALTER TABLE accounting.tax_public_obligations
  DROP CONSTRAINT IF EXISTS
    tax_public_obligations_bank_reconciliation_status_chk;

ALTER TABLE accounting.tax_public_obligations
  ADD CONSTRAINT
    tax_public_obligations_bank_reconciliation_status_chk
  CHECK (
    bank_reconciliation_status_code IN (
      'unmatched',
      'matched',
      'ambiguous',
      'error'
    )
  );

CREATE INDEX IF NOT EXISTS
  tax_public_obligations_bank_transaction_idx
ON accounting.tax_public_obligations (
  bank_transaction_id
);

CREATE INDEX IF NOT EXISTS
  tax_public_obligations_bank_status_idx
ON accounting.tax_public_obligations (
  company_id,
  bank_reconciliation_status_code,
  status_code,
  due_date
);

CREATE TABLE IF NOT EXISTS
  accounting.tax_public_bank_reconciliation_log (
    tax_public_bank_reconciliation_log_id
      BIGSERIAL PRIMARY KEY,

    tax_public_obligation_id
      BIGINT NOT NULL,

    bank_transaction_id
      BIGINT NULL,

    result_code
      TEXT NOT NULL,

    candidate_count
      INTEGER NOT NULL DEFAULT 0,

    match_score
      INTEGER NOT NULL DEFAULT 0,

    message
      TEXT NOT NULL DEFAULT '',

    created_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

CREATE INDEX IF NOT EXISTS
  tax_public_bank_reconciliation_log_obligation_idx
ON accounting.tax_public_bank_reconciliation_log (
  tax_public_obligation_id,
  created_at DESC
);

CREATE OR REPLACE FUNCTION
  accounting.reconcile_withholding_tax_bank_transactions()
RETURNS TABLE (
  matched_count INTEGER,
  ambiguous_count INTEGER,
  unmatched_count INTEGER,
  error_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_obligation RECORD;
  v_candidate RECORD;
  v_candidate_count INTEGER;
  v_matched INTEGER := 0;
  v_ambiguous INTEGER := 0;
  v_unmatched INTEGER := 0;
  v_error INTEGER := 0;
BEGIN
  FOR v_obligation IN
    SELECT
      o.tax_public_obligation_id,
      o.company_id,
      o.payment_amount,
      o.currency_code,
      o.recognition_date,
      o.due_date,
      o.tax_item_code,
      o.source_type_code
    FROM accounting.tax_public_obligations o
    WHERE
      o.source_type_code =
        'withholding_tax_ledger'
      AND o.status_code =
        'scheduled'
      AND o.bank_reconciliation_status_code
        IN (
          'unmatched',
          'ambiguous',
          'error'
        )
  LOOP
    BEGIN
      SELECT
        COUNT(*)::INTEGER
      INTO v_candidate_count
      FROM accounting.bank_transactions b
      WHERE
        b.company_id =
          v_obligation.company_id

        AND b.currency_code =
          v_obligation.currency_code

        AND b.withdrawal_amount =
          v_obligation.payment_amount

        AND b.deposit_amount = 0

        AND b.is_cancelled = FALSE

        AND b.reconciliation_status_code =
          'unreconciled'

        AND b.transaction_date >=
          v_obligation.recognition_date

        AND b.transaction_date <=
          COALESCE(
            v_obligation.due_date + 7,
            v_obligation.recognition_date + 45
          )

        AND (
          COALESCE(b.description, '') ILIKE
            '%源泉%'

          OR COALESCE(b.description, '') ILIKE
            '%所得税%'

          OR COALESCE(b.description, '') ILIKE
            '%国税%'

          OR COALESCE(b.description, '') ILIKE
            '%税務署%'

          OR COALESCE(b.description, '') ILIKE
            '%ダイレクト納付%'

          OR COALESCE(b.counterparty_name, '') ILIKE
            '%国税%'

          OR COALESCE(b.counterparty_name, '') ILIKE
            '%税務署%'
        );

      IF v_candidate_count = 1 THEN
        SELECT
          b.bank_transaction_id,
          b.transaction_date,
          b.description,
          b.counterparty_name
        INTO v_candidate
        FROM accounting.bank_transactions b
        WHERE
          b.company_id =
            v_obligation.company_id

          AND b.currency_code =
            v_obligation.currency_code

          AND b.withdrawal_amount =
            v_obligation.payment_amount

          AND b.deposit_amount = 0

          AND b.is_cancelled = FALSE

          AND b.reconciliation_status_code =
            'unreconciled'

          AND b.transaction_date >=
            v_obligation.recognition_date

          AND b.transaction_date <=
            COALESCE(
              v_obligation.due_date + 7,
              v_obligation.recognition_date + 45
            )

          AND (
            COALESCE(b.description, '') ILIKE
              '%源泉%'

            OR COALESCE(b.description, '') ILIKE
              '%所得税%'

            OR COALESCE(b.description, '') ILIKE
              '%国税%'

            OR COALESCE(b.description, '') ILIKE
              '%税務署%'

            OR COALESCE(b.description, '') ILIKE
              '%ダイレクト納付%'

            OR COALESCE(b.counterparty_name, '') ILIKE
              '%国税%'

            OR COALESCE(b.counterparty_name, '') ILIKE
              '%税務署%'
          )
        ORDER BY
          b.transaction_date,
          b.bank_transaction_id
        LIMIT 1;

        UPDATE accounting.tax_public_obligations
        SET
          bank_transaction_id =
            v_candidate.bank_transaction_id,

          bank_reconciliation_status_code =
            'matched',

          bank_reconciliation_message =
            '会社・通貨・金額・日付・税金語句が完全一致し、一意候補として自動照合しました。',

          bank_match_score = 100,

          bank_matched_at = NOW(),

          status_code = 'paid',

          paid_at =
            v_candidate.transaction_date::TIMESTAMPTZ,

          paid_reference =
            'BANK_TRANSACTION:' ||
            v_candidate.bank_transaction_id::TEXT,

          machine_validation_status =
            'valid',

          machine_validation_message =
            NULL,

          updated_at = NOW()

        WHERE
          tax_public_obligation_id =
            v_obligation.tax_public_obligation_id;

        UPDATE accounting.bank_transactions
        SET
          reconciliation_status_code =
            'reconciled',

          source_type_code =
            'tax_public_obligation',

          source_reference =
            '源泉所得税納付予定',

          source_key =
            'TAX_PUBLIC_OBLIGATION:' ||
            v_obligation.tax_public_obligation_id::TEXT,

          updated_at = NOW()

        WHERE
          bank_transaction_id =
            v_candidate.bank_transaction_id;

        INSERT INTO
          accounting.tax_public_bank_reconciliation_log (
            tax_public_obligation_id,
            bank_transaction_id,
            result_code,
            candidate_count,
            match_score,
            message
          )
        VALUES (
          v_obligation.tax_public_obligation_id,
          v_candidate.bank_transaction_id,
          'matched',
          1,
          100,
          '完全一致・一意候補のため自動paid'
        );

        v_matched := v_matched + 1;

      ELSIF v_candidate_count > 1 THEN
        UPDATE accounting.tax_public_obligations
        SET
          bank_transaction_id = NULL,

          bank_reconciliation_status_code =
            'ambiguous',

          bank_reconciliation_message =
            '同一条件の銀行明細が複数あるため、自動確定を停止しました。',

          bank_match_score = 0,

          machine_validation_status =
            'error',

          machine_validation_message =
            '銀行明細の一意性を確認できません。',

          updated_at = NOW()

        WHERE
          tax_public_obligation_id =
            v_obligation.tax_public_obligation_id;

        INSERT INTO
          accounting.tax_public_bank_reconciliation_log (
            tax_public_obligation_id,
            bank_transaction_id,
            result_code,
            candidate_count,
            match_score,
            message
          )
        VALUES (
          v_obligation.tax_public_obligation_id,
          NULL,
          'ambiguous',
          v_candidate_count,
          0,
          '一致候補が複数のため機械停止'
        );

        v_ambiguous :=
          v_ambiguous + 1;

      ELSE
        UPDATE accounting.tax_public_obligations
        SET
          bank_transaction_id = NULL,

          bank_reconciliation_status_code =
            'unmatched',

          bank_reconciliation_message =
            '完全一致する銀行明細はまだありません。',

          bank_match_score = 0,

          updated_at = NOW()

        WHERE
          tax_public_obligation_id =
            v_obligation.tax_public_obligation_id;

        v_unmatched :=
          v_unmatched + 1;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        UPDATE accounting.tax_public_obligations
        SET
          bank_reconciliation_status_code =
            'error',

          bank_reconciliation_message =
            SQLERRM,

          bank_match_score = 0,

          machine_validation_status =
            'error',

          machine_validation_message =
            '銀行明細自動照合処理でDBエラーが発生しました。',

          updated_at = NOW()

        WHERE
          tax_public_obligation_id =
            v_obligation.tax_public_obligation_id;

        INSERT INTO
          accounting.tax_public_bank_reconciliation_log (
            tax_public_obligation_id,
            bank_transaction_id,
            result_code,
            candidate_count,
            match_score,
            message
          )
        VALUES (
          v_obligation.tax_public_obligation_id,
          NULL,
          'error',
          0,
          0,
          SQLERRM
        );

        v_error := v_error + 1;
    END;
  END LOOP;

  RETURN QUERY
  SELECT
    v_matched,
    v_ambiguous,
    v_unmatched,
    v_error;
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
  o.updated_at,

  o.bank_transaction_id,
  o.bank_reconciliation_status_code,
  o.bank_reconciliation_message,
  o.bank_matched_at,
  o.bank_match_score

FROM
  accounting.tax_public_obligations o

LEFT JOIN expenses.companies c
  ON c.company_id = o.company_id;

COMMENT ON FUNCTION
  accounting.reconcile_withholding_tax_bank_transactions()
IS
  '源泉所得税納付予定と銀行出金明細を、会社・通貨・金額・日付・税金語句で厳格照合し、一意一致のみ自動paidにする。';

COMMIT;