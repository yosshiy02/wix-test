const fs = require("fs");
const path = require("path");
const pool = require("./src/db");

function q(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

(async () => {
  const schema = "expenses";
  const limit = 100;

  const reportPath = path.join(__dirname, "expenses_tables_report.txt");

  const tablesResult = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `, [schema]);

  let report = "";
  report += "=== expenses スキーマ テーブル中身確認 ===\n";
  report += "作成日時: " + new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) + "\n";
  report += "表示件数: 各テーブル最大 " + limit + " 件\n\n";

  console.log("");
  console.log("=== expenses スキーマ テーブル一覧 ===");
  console.table(tablesResult.rows);

  for (const t of tablesResult.rows) {
    const table = t.table_name;

    const columnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position
    `, [schema, table]);

    const columns = columnsResult.rows.map(r => r.column_name);

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ${q(schema)}.${q(table)}`
    );

    const count = countResult.rows[0].count;

    let orderBy = "";

    if (columns.includes("sort_order")) {
      const idCol = columns.find(c => c.endsWith("_id")) || columns[0];
      orderBy = `ORDER BY ${q("sort_order")}, ${q(idCol)}`;
    } else if (columns.includes("expense_id") && columns.includes("line_no")) {
      orderBy = `ORDER BY ${q("expense_id")}, ${q("line_no")}`;
    } else if (columns.includes("expense_id")) {
      orderBy = `ORDER BY ${q("expense_id")} DESC`;
    } else if (columns.includes("created_at")) {
      orderBy = `ORDER BY ${q("created_at")} DESC`;
    } else if (columns.includes("id")) {
      orderBy = `ORDER BY ${q("id")} DESC`;
    }

    const rowsResult = await pool.query(
      `SELECT * FROM ${q(schema)}.${q(table)} ${orderBy} LIMIT $1`,
      [limit]
    );

    console.log("");
    console.log("==================================================");
    console.log(`TABLE: ${schema}.${table}`);
    console.log(`COUNT: ${count}`);
    console.log("COLUMNS:", columns.join(", "));
    console.table(rowsResult.rows);

    report += "==================================================\n";
    report += `TABLE: ${schema}.${table}\n`;
    report += `COUNT: ${count}\n`;
    report += "COLUMNS: " + columns.join(", ") + "\n";
    report += JSON.stringify(rowsResult.rows, null, 2);
    report += "\n\n";
  }

  fs.writeFileSync(reportPath, report, "utf8");

  await pool.end();

  console.log("");
  console.log("完了。レポート保存先:");
  console.log(reportPath);
})().catch(async err => {
  console.error(err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
