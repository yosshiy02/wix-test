const fs = require("fs");
const pool = require("./src/db");

const outPath = "G:\\GITHUB\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\memo\\00_勘定科目ID並べ直し前_参照確認.txt";

async function main() {
  const lines = [];
  lines.push("==============================");
  lines.push("勘定科目ID並べ直し前 参照確認");
  lines.push("==============================");

  const fkResult = await pool.query(
    "SELECT " +
    "tc.table_schema, tc.table_name, kcu.column_name, " +
    "ccu.table_schema AS ref_schema, ccu.table_name AS ref_table, ccu.column_name AS ref_column " +
    "FROM information_schema.table_constraints tc " +
    "JOIN information_schema.key_column_usage kcu " +
    "ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema " +
    "JOIN information_schema.constraint_column_usage ccu " +
    "ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema " +
    "WHERE tc.constraint_type = 'FOREIGN KEY' " +
    "AND ccu.table_schema = 'expenses' " +
    "AND ccu.table_name = 'account_titles' " +
    "ORDER BY tc.table_schema, tc.table_name, kcu.column_name"
  );

  lines.push("");
  lines.push("外部キー参照:");
  if (fkResult.rowCount === 0) {
    lines.push("なし");
  } else {
    for (const row of fkResult.rows) {
      lines.push(`${row.table_schema}.${row.table_name}.${row.column_name} -> ${row.ref_schema}.${row.ref_table}.${row.ref_column}`);
    }
  }

  const colResult = await pool.query(
    "SELECT table_schema, table_name, column_name " +
    "FROM information_schema.columns " +
    "WHERE table_schema = 'expenses' " +
    "AND column_name ILIKE '%account_title_id%' " +
    "ORDER BY table_schema, table_name, column_name"
  );

  lines.push("");
  lines.push("account_title_id系カラム:");
  if (colResult.rowCount === 0) {
    lines.push("なし");
  } else {
    for (const row of colResult.rows) {
      lines.push(`${row.table_schema}.${row.table_name}.${row.column_name}`);
    }
  }

  lines.push("");
  lines.push("現在の勘定科目:");
  const accounts = await pool.query(
    "SELECT account_title_id, account_code, account_name, sort_order, is_active " +
    "FROM expenses.account_titles " +
    "ORDER BY account_title_id"
  );

  lines.push("ID\tCODE\tACTIVE\tSORT\tNAME");
  for (const row of accounts.rows) {
    lines.push([
      row.account_title_id,
      row.account_code || "",
      row.is_active ? "ON" : "OFF",
      row.sort_order ?? "",
      row.account_name
    ].join("\t"));
  }

  lines.push("");
  lines.push(`件数: ${accounts.rowCount}`);
  lines.push("");
  lines.push("次の判断:");
  lines.push("- 外部キー参照なし、または参照データなしなら、IDを1から並べ直せる");
  lines.push("- 参照ありなら、参照先も同時に更新する手順が必要");

  fs.writeFileSync(outPath, lines.join("\r\n"), "utf8");
  await pool.end();
}

main().catch(async err => {
  fs.writeFileSync(outPath, "NG:\r\n" + err.stack, "utf8");
  try { await pool.end(); } catch {}
  process.exit(1);
});
