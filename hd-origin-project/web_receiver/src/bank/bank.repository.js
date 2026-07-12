const pool = require("../db");

function normalizeCompanyId(value) {
  const companyId = Number(value);

  if (
    !Number.isInteger(companyId) ||
    companyId <= 0
  ) {
    const error =
      new Error("有効な会社IDが必要です。");

    error.statusCode = 400;
    throw error;
  }

  return companyId;
}

async function assertActiveCompany(companyId) {
  const result = await pool.query(
    `
    SELECT
      company_id,
      company_code,
      company_name
    FROM expenses.companies
    WHERE company_id = $1
      AND is_active = TRUE
    `,
    [companyId]
  );

  if (!result.rows[0]) {
    const error =
      new Error(
        "対象会社が会社マスタにありません。"
      );

    error.statusCode = 400;
    throw error;
  }

  return result.rows[0];
}

async function listAccounts(companyIdValue) {
  const companyId =
    normalizeCompanyId(companyIdValue);

  const company =
    await assertActiveCompany(companyId);

  const result = await pool.query(
    `
    SELECT
      bank_account_id,
      company_id,
      company_code,
      company_name,
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
      current_balance,
      transaction_count,
      is_dummy,
      is_active
    FROM accounting.v_bank_accounts
    WHERE company_id = $1
      AND is_active = TRUE
    ORDER BY
      sort_order,
      bank_account_id
    `,
    [companyId]
  );

  return {
    company,
    accounts: result.rows
  };
}

async function listTransactions(
  companyIdValue,
  options = {}
) {
  const companyId =
    normalizeCompanyId(companyIdValue);

  const company =
    await assertActiveCompany(companyId);

  const limit = Math.min(
    Math.max(
      Number(options.limit) || 200,
      1
    ),
    1000
  );

  const result = await pool.query(
    `
    SELECT
      bank_transaction_id,
      company_id,
      company_code,
      company_name,
      bank_account_id,
      bank_name,
      branch_name,
      account_type_name,
      account_number,
      transaction_date,
      value_date,
      transaction_type_code,
      transaction_type_name,
      description,
      counterparty_name,
      deposit_amount,
      withdrawal_amount,
      running_balance,
      currency_code,
      reconciliation_status_code,
      reconciliation_status_name,
      source_type_code,
      source_reference,
      is_dummy
    FROM accounting.v_bank_transactions
    WHERE company_id = $1
    ORDER BY
      transaction_date DESC,
      bank_transaction_id DESC
    LIMIT $2
    `,
    [
      companyId,
      limit
    ]
  );

  return {
    company,
    transactions: result.rows
  };
}

async function getSummary(companyIdValue) {
  const companyId =
    normalizeCompanyId(companyIdValue);

  const company =
    await assertActiveCompany(companyId);

  const result = await pool.query(
    `
    SELECT
      COUNT(DISTINCT a.bank_account_id)
        AS account_count,

      COALESCE(
        SUM(account_balances.current_balance),
        0
      ) AS current_balance,

      COALESCE(
        SUM(account_balances.deposit_total),
        0
      ) AS deposit_total,

      COALESCE(
        SUM(account_balances.withdrawal_total),
        0
      ) AS withdrawal_total,

      COALESCE(
        SUM(account_balances.transaction_count),
        0
      ) AS transaction_count,

      COALESCE(
        SUM(account_balances.unreconciled_count),
        0
      ) AS unreconciled_count

    FROM accounting.bank_accounts a

    LEFT JOIN LATERAL (
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN t.is_cancelled = FALSE
              THEN
                t.deposit_amount -
                t.withdrawal_amount
              ELSE 0
            END
          ),
          0
        ) AS current_balance,

        COALESCE(
          SUM(
            CASE
              WHEN t.is_cancelled = FALSE
              THEN t.deposit_amount
              ELSE 0
            END
          ),
          0
        ) AS deposit_total,

        COALESCE(
          SUM(
            CASE
              WHEN t.is_cancelled = FALSE
              THEN t.withdrawal_amount
              ELSE 0
            END
          ),
          0
        ) AS withdrawal_total,

        COUNT(*) FILTER (
          WHERE t.is_cancelled = FALSE
        ) AS transaction_count,

        COUNT(*) FILTER (
          WHERE t.is_cancelled = FALSE
            AND t.reconciliation_status_code =
                'unreconciled'
        ) AS unreconciled_count

      FROM accounting.bank_transactions t
      WHERE t.bank_account_id =
            a.bank_account_id
        AND t.company_id =
            a.company_id
    ) account_balances
      ON TRUE

    WHERE a.company_id = $1
      AND a.is_active = TRUE
    `,
    [companyId]
  );

  return {
    company,
    summary: result.rows[0] || {
      account_count: 0,
      current_balance: 0,
      deposit_total: 0,
      withdrawal_total: 0,
      transaction_count: 0,
      unreconciled_count: 0
    }
  };
}

module.exports = {
  listAccounts,
  listTransactions,
  getSummary
};