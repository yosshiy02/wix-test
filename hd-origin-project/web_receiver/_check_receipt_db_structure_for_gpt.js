const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

const envPath = process.argv[2];
const reportPath = process.argv[3];

if (!envPath || !fs.existsSync(envPath)) {
  throw new Error(".env が見つかりません: " + envPath);
}

dotenv.config({ path: envPath });

const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
const missing = required.filter(key => !process.env[key]);

const pool = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD || "")
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
  lines.push("確認日時: " + new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
  lines.push("ENV_PATH: " + envPath);
  lines.push("DB_HOST: " + (process.env.DB_HOST || ""));
  lines.push("DB_PORT: " + (process.env.DB_PORT || ""));
  lines.push("DB_NAME: " + (process.env.DB_NAME || ""));
  lines.push("DB_USER: " + (process.env.DB_USER || ""));
  lines.push("DB_PASSWORD: ********");
  lines.push("");

  if (missing.length) {
    lines.push("[警告] .env に不足している項目:");
    for (const key of missing) lines.push("- " + key);
    lines.push("");
  }

  const tableResult = await pool.query(`
    select
      table_schema,
      table_name
    from information_schema.tables
    where table_schema = 'expenses'
    order by table_schema, table_name
  `);

  lines.push("[expenses スキーマ内テーブル一覧]");
  if (tableResult.rows.length === 0) {
    lines.push("なし");
  } else {
    for (const row of tableResult.rows) {
      lines.push("- " + row.table_schema + "." + row.table_name);
    }
  }
  lines.push("");

  for (const fullName of targets) {
    const [schema, table] = fullName.split(".");

    const existsResult = await pool.query(`
      select exists (
        select 1
        from information_schema.tables
        where table_schema = $1
          and table_name = $2
      ) as exists
    `, [schema, table]);

    lines.push("------------------------------------------------------------");
    lines.push("[" + fullName + "]");
    lines.push("存在: " + (existsResult.rows[0].exists ? "あり" : "なし"));

    if (!existsResult.rows[0].exists) {
      lines.push("");
      continue;
    }

    const columnsResult = await pool.query(`
      select
        ordinal_position,
        column_name,
        data_type,
        is_nullable,
        column_default
      from information_schema.columns
      where table_schema = $1
        and table_name = $2
      order by ordinal_position
    `, [schema, table]);

    lines.push("");
    lines.push("カラム:");
    for (const col of columnsResult.rows) {
      lines.push(
        String(col.ordinal_position).padStart(2, "0") + ". " +
        col.column_name + " / " +
        col.data_type + " / nullable=" +
        col.is_nullable +
        (col.column_default ? " / default=" + col.column_default : "")
      );
    }

    const pkResult = await pool.query(`
      select
        kcu.column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      where tc.constraint_type = 'PRIMARY KEY'
        and tc.table_schema = $1
        and tc.table_name = $2
      order by kcu.ordinal_position
    `, [schema, table]);

    lines.push("");
    lines.push("主キー:");
    if (pkResult.rows.length === 0) {
      lines.push("なし");
    } else {
      for (const pk of pkResult.rows) {
        lines.push("- " + pk.column_name);
      }
    }

    const fkResult = await pool.query(`
      select
        tc.constraint_name,
        kcu.column_name,
        ccu.table_schema as foreign_table_schema,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = $1
        and tc.table_name = $2
      order by tc.constraint_name, kcu.ordinal_position
    `, [schema, table]);

    lines.push("");
    lines.push("外部キー:");
    if (fkResult.rows.length === 0) {
      lines.push("なし");
    } else {
      for (const fk of fkResult.rows) {
        lines.push(
          "- " + fk.column_name +
          " -> " + fk.foreign_table_schema + "." +
          fk.foreign_table_name + "." +
          fk.foreign_column_name +
          " (" + fk.constraint_name + ")"
        );
      }
    }

    const countResult = await pool.query(`select count(*)::int as count from ${schema}.${table}`);
    lines.push("");
    lines.push("件数: " + countResult.rows[0].count);
    lines.push("");
  }

  fs.writeFileSync(reportPath, lines.join("\r\n"), "utf8");
}

main()
  .catch(err => {
    const lines = [];
    lines.push("DB レシート関連 構造確認 エラー");
    lines.push("================================");
    lines.push("");
    lines.push("ENV_PATH: " + envPath);
    lines.push("");
    lines.push(err.stack || err.message);
    fs.writeFileSync(reportPath, lines.join("\r\n"), "utf8");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });