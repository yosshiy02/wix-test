BEGIN;

SET client_encoding TO 'UTF8';
CREATE SCHEMA IF NOT EXISTS accounting;

CREATE TABLE IF NOT EXISTS accounting.bank_accounts (
  bank_account_id BIGSERIAL PRIMARY KEY,

  company_id BIGINT NOT NULL
    REFERENCES expenses.companies(company_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  bank_code TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL,
  branch_code TEXT NOT NULL DEFAULT '',
  branch_name TEXT NOT NULL DEFAULT '',

  account_type_code TEXT NOT NULL DEFAULT 'ordinary',
  account_type_name TEXT NOT NULL DEFAULT '普通預金',

  account_number TEXT NOT NULL,
  account_holder_name TEXT NOT NULL DEFAULT '',

  currency_code TEXT NOT NULL DEFAULT 'JPY',
  opening_date DATE NOT NULL,
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,

  is_dummy BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bank_accounts_opening_balance_nonnegative
    CHECK (opening_balance >= 0),

  /*
    bank_transactions から
    (company_id, bank_account_id) を複合外部キー参照するため、
    親側にも同一列の一意制約を持たせる。
  */
  CONSTRAINT bank_accounts_company_id_account_id_unique
    UNIQUE (
      company_id,
      bank_account_id
    ),

  CONSTRAINT bank_accounts_company_account_unique
    UNIQUE (
      company_id,
      bank_code,
      branch_code,
      account_type_code,
      account_number
    )
);

CREATE INDEX IF NOT EXISTS ix_bank_accounts_company
ON accounting.bank_accounts (
  company_id,
  is_active,
  sort_order,
  bank_account_id
);

CREATE TABLE IF NOT EXISTS accounting.bank_transactions (
  bank_transaction_id BIGSERIAL PRIMARY KEY,

  company_id BIGINT NOT NULL
    REFERENCES expenses.companies(company_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  bank_account_id BIGINT NOT NULL
    REFERENCES accounting.bank_accounts(bank_account_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  transaction_date DATE NOT NULL,
  value_date DATE,

  transaction_type_code TEXT NOT NULL,
  transaction_type_name TEXT NOT NULL,

  description TEXT NOT NULL DEFAULT '',
  counterparty_name TEXT NOT NULL DEFAULT '',

  deposit_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  withdrawal_amount NUMERIC(18,2) NOT NULL DEFAULT 0,

  currency_code TEXT NOT NULL DEFAULT 'JPY',

  reconciliation_status_code TEXT NOT NULL DEFAULT 'unreconciled',
  reconciliation_status_name TEXT NOT NULL DEFAULT '未照合',

  source_type_code TEXT NOT NULL DEFAULT 'manual',
  source_reference TEXT NOT NULL DEFAULT '',
  source_key TEXT,

  is_dummy BOOLEAN NOT NULL DEFAULT FALSE,
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bank_transactions_amount_nonnegative
    CHECK (
      deposit_amount >= 0
      AND withdrawal_amount >= 0
    ),

  CONSTRAINT bank_transactions_one_side_only
    CHECK (
      (
        deposit_amount > 0
        AND withdrawal_amount = 0
      )
      OR
      (
        deposit_amount = 0
        AND withdrawal_amount > 0
      )
    ),

  CONSTRAINT bank_transactions_company_account_fk
    FOREIGN KEY (
      company_id,
      bank_account_id
    )
    REFERENCES accounting.bank_accounts (
      company_id,
      bank_account_id
    )
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bank_transactions_source_key
ON accounting.bank_transactions(source_key)
WHERE source_key IS NOT NULL
  AND source_key <> '';

CREATE INDEX IF NOT EXISTS ix_bank_transactions_company_date
ON accounting.bank_transactions (
  company_id,
  transaction_date DESC,
  bank_transaction_id DESC
);

CREATE INDEX IF NOT EXISTS ix_bank_transactions_account_date
ON accounting.bank_transactions (
  bank_account_id,
  transaction_date,
  bank_transaction_id
);

CREATE OR REPLACE VIEW accounting.v_bank_transactions AS
SELECT
  t.bank_transaction_id,
  t.company_id,
  c.company_code,
  c.company_name,

  t.bank_account_id,
  a.bank_code,
  a.bank_name,
  a.branch_code,
  a.branch_name,
  a.account_type_code,
  a.account_type_name,
  a.account_number,
  a.account_holder_name,

  t.transaction_date,
  t.value_date,
  t.transaction_type_code,
  t.transaction_type_name,
  t.description,
  t.counterparty_name,
  t.deposit_amount,
  t.withdrawal_amount,
  t.currency_code,

  SUM(
    t.deposit_amount -
    t.withdrawal_amount
  ) OVER (
    PARTITION BY t.bank_account_id
    ORDER BY
      t.transaction_date,
      t.bank_transaction_id
    ROWS BETWEEN
      UNBOUNDED PRECEDING
      AND CURRENT ROW
  ) AS running_balance,

  t.reconciliation_status_code,
  t.reconciliation_status_name,
  t.source_type_code,
  t.source_reference,
  t.source_key,
  t.is_dummy,
  t.is_cancelled,
  t.created_at,
  t.updated_at
FROM accounting.bank_transactions t
JOIN accounting.bank_accounts a
  ON a.bank_account_id = t.bank_account_id
 AND a.company_id = t.company_id
JOIN expenses.companies c
  ON c.company_id = t.company_id
WHERE t.is_cancelled = FALSE;

CREATE OR REPLACE VIEW accounting.v_bank_accounts AS
SELECT
  a.bank_account_id,
  a.company_id,
  c.company_code,
  c.company_name,

  a.bank_code,
  a.bank_name,
  a.branch_code,
  a.branch_name,
  a.account_type_code,
  a.account_type_name,
  a.account_number,
  a.account_holder_name,
  a.currency_code,
  a.opening_date,
  a.opening_balance,
  a.is_dummy,
  a.is_active,
  a.sort_order,

  COALESCE(
    SUM(
      CASE
        WHEN t.is_cancelled = FALSE
        THEN t.deposit_amount - t.withdrawal_amount
        ELSE 0
      END
    ),
    0
  ) AS current_balance,

  COUNT(
    t.bank_transaction_id
  ) FILTER (
    WHERE t.is_cancelled = FALSE
  ) AS transaction_count,

  a.created_at,
  a.updated_at
FROM accounting.bank_accounts a
JOIN expenses.companies c
  ON c.company_id = a.company_id
LEFT JOIN accounting.bank_transactions t
  ON t.bank_account_id = a.bank_account_id
 AND t.company_id = a.company_id
GROUP BY
  a.bank_account_id,
  a.company_id,
  c.company_code,
  c.company_name;

WITH target_companies AS (
  SELECT
    company_id,
    company_code,
    company_name,
    CASE
      WHEN company_name = '株式会社ハトダイヤ'
        THEN '0000001'
      WHEN company_name = '株式会社HDオリジンスタイル'
        THEN '0000002'
      WHEN company_name = '有限会社坂口勝康商店'
        THEN '0000003'
      ELSE NULL
    END AS dummy_account_number,

    CASE
      WHEN company_name = '株式会社ハトダイヤ'
        THEN '株式会社ハトダイヤ'
      WHEN company_name = '株式会社HDオリジンスタイル'
        THEN '株式会社HDオリジンスタイル'
      WHEN company_name = '有限会社坂口勝康商店'
        THEN '有限会社坂口勝康商店'
      ELSE company_name
    END AS holder_name

  FROM expenses.companies
  WHERE is_active = TRUE
    AND company_name IN (
      '株式会社ハトダイヤ',
      '株式会社HDオリジンスタイル',
      '有限会社坂口勝康商店'
    )
),
upserted_accounts AS (
  INSERT INTO accounting.bank_accounts (
    company_id,
    bank_code,
    bank_name,
    branch_code,
    branch_name,
    account_type_code,
    account_type_name,
    account_number,
    account_holder_name,
    currency_code,
    opening_date,
    opening_balance,
    is_dummy,
    is_active,
    sort_order,
    updated_at
  )
  SELECT
    company_id,
    '0005',
    '三菱UFJ銀行',
    '001',
    'ダミー本店',
    'ordinary',
    '普通預金',
    dummy_account_number,
    holder_name,
    'JPY',
    DATE '2026-07-11',
    10000000,
    TRUE,
    TRUE,
    10,
    NOW()
  FROM target_companies
  WHERE dummy_account_number IS NOT NULL

  ON CONFLICT (
    company_id,
    bank_code,
    branch_code,
    account_type_code,
    account_number
  )
  DO UPDATE SET
    bank_name = EXCLUDED.bank_name,
    branch_name = EXCLUDED.branch_name,
    account_type_name =
      EXCLUDED.account_type_name,
    account_holder_name =
      EXCLUDED.account_holder_name,
    currency_code = EXCLUDED.currency_code,
    opening_date = EXCLUDED.opening_date,
    opening_balance = EXCLUDED.opening_balance,
    is_dummy = TRUE,
    is_active = TRUE,
    updated_at = NOW()

  RETURNING
    bank_account_id,
    company_id,
    account_number
)
INSERT INTO accounting.bank_transactions (
  company_id,
  bank_account_id,
  transaction_date,
  value_date,
  transaction_type_code,
  transaction_type_name,
  description,
  counterparty_name,
  deposit_amount,
  withdrawal_amount,
  currency_code,
  reconciliation_status_code,
  reconciliation_status_name,
  source_type_code,
  source_reference,
  source_key,
  is_dummy,
  is_cancelled
)
SELECT
  a.company_id,
  a.bank_account_id,
  DATE '2026-07-11',
  DATE '2026-07-11',
  'opening_balance',
  '開始残高',
  'ダミー通帳 開始残高',
  '',
  10000000,
  0,
  'JPY',
  'not_required',
  '照合不要',
  'dummy_seed',
  '各社ダミー通帳開始残高',
  'DUMMY_OPENING_BALANCE:' ||
    a.company_id::TEXT ||
    ':' ||
    a.account_number,
  TRUE,
  FALSE
FROM upserted_accounts a
JOIN target_companies c
  ON c.company_id = a.company_id
 AND c.dummy_account_number =
     a.account_number
ON CONFLICT (source_key)
WHERE source_key IS NOT NULL
  AND source_key <> ''
DO UPDATE SET
  deposit_amount = 10000000,
  withdrawal_amount = 0,
  transaction_date = DATE '2026-07-11',
  value_date = DATE '2026-07-11',
  description = 'ダミー通帳 開始残高',
  is_dummy = TRUE,
  is_cancelled = FALSE,
  updated_at = NOW();

DO $$
DECLARE
  target_company_count INTEGER;
  target_account_count INTEGER;
  opening_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO target_company_count
  FROM expenses.companies
  WHERE is_active = TRUE
    AND company_name IN (
      '株式会社ハトダイヤ',
      '株式会社HDオリジンスタイル',
      '有限会社坂口勝康商店'
    );

  IF target_company_count <> 3 THEN
    RAISE EXCEPTION
      '対象会社が3社揃っていません。件数=%',
      target_company_count;
  END IF;

  SELECT COUNT(*)
  INTO target_account_count
  FROM accounting.bank_accounts a
  JOIN expenses.companies c
    ON c.company_id = a.company_id
  WHERE a.is_dummy = TRUE
    AND a.bank_code = '0005'
    AND a.branch_code = '001'
    AND a.account_type_code = 'ordinary'
    AND a.opening_balance = 10000000
    AND c.company_name IN (
      '株式会社ハトダイヤ',
      '株式会社HDオリジンスタイル',
      '有限会社坂口勝康商店'
    );

  IF target_account_count <> 3 THEN
    RAISE EXCEPTION
      'ダミー銀行口座が3件ではありません。件数=%',
      target_account_count;
  END IF;

  SELECT COUNT(*)
  INTO opening_count
  FROM accounting.bank_transactions t
  JOIN expenses.companies c
    ON c.company_id = t.company_id
  WHERE t.is_dummy = TRUE
    AND t.transaction_type_code =
        'opening_balance'
    AND t.deposit_amount = 10000000
    AND t.withdrawal_amount = 0
    AND t.transaction_date =
        DATE '2026-07-11'
    AND c.company_name IN (
      '株式会社ハトダイヤ',
      '株式会社HDオリジンスタイル',
      '有限会社坂口勝康商店'
    );

  IF opening_count <> 3 THEN
    RAISE EXCEPTION
      '開始残高明細が3件ではありません。件数=%',
      opening_count;
  END IF;
END
$$;

COMMIT;