const pool = require("./src/db");

async function main() {
  const accountTitles = [
    ["EXP001", "消耗品費", 10],
    ["EXP002", "旅費交通費", 20],
    ["EXP003", "通信費", 30],
    ["EXP004", "荷造運賃", 40],
    ["EXP005", "支払手数料", 50],
    ["EXP006", "広告宣伝費", 60],
    ["EXP007", "地代家賃", 70],
    ["EXP008", "水道光熱費", 80],
    ["EXP009", "雑費", 90],
    ["EXP010", "仕入高", 100]
  ];

  const paymentMethods = [
    ["現金", "現金", 10],
    ["普通預金", "普通預金", 20],
    ["銀行振込", "普通預金", 30],
    ["口座引落", "普通預金", 40],
    ["クレジットカード", "未払金", 50]
  ];

  const taxCategories = [
    ["課税10%", 10, 10],
    ["軽減8%", 8, 20],
    ["非課税", 0, 30],
    ["不課税", 0, 40],
    ["対象外", 0, 50]
  ];

  for (const [code, name, sort] of accountTitles) {
    await pool.query(
      `
      INSERT INTO expenses.account_titles
        (account_code, account_name, sort_order, is_active)
      VALUES
        ($1, $2, $3, TRUE)
      ON CONFLICT (account_name)
      DO UPDATE SET
        account_code = EXCLUDED.account_code,
        sort_order = EXCLUDED.sort_order,
        is_active = TRUE
      `,
      [code, name, sort]
    );
  }

  for (const [name, credit, sort] of paymentMethods) {
    await pool.query(
      `
      INSERT INTO expenses.payment_methods
        (method_name, default_credit_account, sort_order, is_active)
      VALUES
        ($1, $2, $3, TRUE)
      ON CONFLICT (method_name)
      DO UPDATE SET
        default_credit_account = EXCLUDED.default_credit_account,
        sort_order = EXCLUDED.sort_order,
        is_active = TRUE
      `,
      [name, credit, sort]
    );
  }

  for (const [name, rate, sort] of taxCategories) {
    await pool.query(
      `
      INSERT INTO expenses.tax_categories
        (tax_name, tax_rate, sort_order, is_active)
      VALUES
        ($1, $2, $3, TRUE)
      ON CONFLICT (tax_name)
      DO UPDATE SET
        tax_rate = EXCLUDED.tax_rate,
        sort_order = EXCLUDED.sort_order,
        is_active = TRUE
      `,
      [name, rate, sort]
    );
  }

  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM expenses.account_titles) AS account_titles,
      (SELECT COUNT(*) FROM expenses.payment_methods) AS payment_methods,
      (SELECT COUNT(*) FROM expenses.tax_categories) AS tax_categories
  `);

  console.log("マスタ投入完了");
  console.table(counts.rows);

  await pool.end();
}

main().catch(async err => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
