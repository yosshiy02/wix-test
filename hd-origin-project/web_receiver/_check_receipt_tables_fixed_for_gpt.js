const fs = require("fs");
const dotenv = require("dotenv");
const { Pool } = require("pg");

const envPath = process.argv[2];
const reportPath = process.argv[3];
const dbHost = process.argv[4];
const dbPort = process.argv[5];
const dbName = process.argv[6];
const dbUser = process.argv[7];

dotenv.config({ path: envPath, override: true });

const dbPassword = String(process.env.DB_PASSWORD || "");

const pool = new Pool({
  host: dbHost,
  port: Number(dbPort),
  database: dbName,
  user: dbUser,
  password: dbPassword
});

const targets = [
  "expenses.receipt_imports",
  "expenses.receipt_ai_drafts",
  "expenses.receipt_files",
  "expenses.expense_headers",
  "expenses.expense_details",
  "expenses.expense_lines",
  "expenses.payment_methods",
  "expenses.vendors",
  "expenses.departments",
  "expenses.projects"
];

async function main() {
  const lines = [];

  lines.push("DB レシート関連 構造確認");
  lines.push("==========================");
  lines.push("");
  lines.push("ENV_PATH: " + envPath);
  lines.push("DB_HOST: " + dbHost);
  lines.push("DB_PORT: " + dbPort);
  lines.push("DB_NAME: " + dbName);
  lines.push("DB_USER: " + dbUser);
  lines.push("DB_PASSWORD: " + (dbPassword ? "********" : "未設定"));
  lines.push("");

  const current = await pool.query(`
    select current_user as current_user, current_database() as current_database
  `);

  lines.push("[接続確認]");
  lines.push("OK");
  lines.push("current_user: " + current.rows[0].current_user);
  lines.push("current_database: " + current.rows[0].current_database);
  lines.push("");

  const allTables = await pool.query(`
    select table_schema, table_name
    from information_schema.tables
    where table_schema = 'expenses'
    order by table_name
  `);

  lines.push("[expenses スキーマ内テーブル一覧]");
  for (const row of allTables.rows) {
    lines.push("- " + row.table_schema + "." + row.table_name);
  }
  lines.push("");

  for (const fullName of targets) {
    const [schema, table] = fullName.split(".");

    lines.push("------------------------------------------------------------");
    lines.push("[" + fullName + "]");

    const exists = await pool.query(`
      select exists (
        select 1
        from information_schema.tables
        where table_schema = $1 and table_name = $2
      ) as exists
    `, [schema, table]);

    if (!exists.rows[0].exists) {
      lines.push("存在: なし");
      lines.push("");
      continue;
    }

    lines.push("存在: あり");

    const cols = await pool.query(`
      select ordinal_position, column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = $1 and table_name = $2
      order by ordinal_position
    `, [schema, table]);

    lines.push("");
    lines.push("カラム:");
    for (const col of cols.rows) {
      lines.push(
        String(col.ordinal_position).padStart(2, "0") + ". " +
        col.column_name + " / " +
        col.data_type + " / nullable=" + col.is_nullable +
        (col.column_default ? " / default=" + col.column_default : "")
      );
    }

    const count = await pool.query(`select count(*)::int as count from ${schema}.${table}`);
    lines.push("");
    lines.push("件数: " + count.rows[0].count);
    lines.push("");
  }

  await pool.end();
  fs.writeFileSync(reportPath, lines.join("\r\n"), "utf8");
}

main().catch(async err => {
  const lines = [];
  lines.push("DB レシート関連 構造確認 エラー");
  lines.push("================================");
  lines.push("");
  lines.push(err.stack || err.message);
  fs.writeFileSync(reportPath, lines.join("\r\n"), "utf8");
  await pool.end().catch(() => {});
  process.exitCode = 1;
});
