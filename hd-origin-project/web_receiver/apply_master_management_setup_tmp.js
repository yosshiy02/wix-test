const fs = require("fs");
const path = require("path");
const pool = require("./src/db");

(async () => {
  const sqlPath = path.join(__dirname, "..", "database", "expenses", "master_management_setup.sql");

  console.log("SQL適用:", sqlPath);

  if (!fs.existsSync(sqlPath)) {
    throw new Error("SQLファイルが見つかりません: " + sqlPath);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");

  await pool.query(sql);

  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM expenses.projects) AS projects,
      (SELECT COUNT(*) FROM expenses.departments) AS departments,
      (SELECT COUNT(*) FROM expenses.account_titles) AS account_titles,
      (SELECT COUNT(*) FROM expenses.payment_methods) AS payment_methods,
      (SELECT COUNT(*) FROM expenses.tax_categories) AS tax_categories
  `);

  console.table(result.rows);

  await pool.end();
  console.log("完了");
})().catch(async err => {
  console.error(err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
