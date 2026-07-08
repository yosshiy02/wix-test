const fs = require("fs");
const path = require("path");

const projectRoot = process.argv[2];
const migrationPath = process.argv[3];
const checkResultPath = process.argv[4];

const webDir = path.join(projectRoot, "web_receiver");
process.chdir(webDir);

const db = require(path.join(webDir, "src", "db"));

async function main() {
  const sql = fs.readFileSync(migrationPath, "utf8");
  await db.query(sql);

  const result = await db.query(`
    SELECT
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'payment_document_contract_insurance_lease_drafts'
    ORDER BY ordinal_position
  `);

  const lines = [];
  lines.push("==============================");
  lines.push("契約・保険・リース専門下書きテーブル 作成確認");
  lines.push("==============================");
  lines.push("日時: " + new Date().toISOString());
  lines.push("");
  lines.push("[列数]");
  lines.push(String(result.rows.length));
  lines.push("");
  lines.push("[列一覧]");
  for (const row of result.rows) {
    lines.push(`${row.column_name} / ${row.data_type} / nullable=${row.is_nullable}`);
  }

  fs.writeFileSync(checkResultPath, lines.join("\r\n"), "utf8");
  await db.end();
}

main().catch(async err => {
  fs.writeFileSync(checkResultPath, String(err && err.stack ? err.stack : err), "utf8");
  try { await db.end(); } catch {}
  process.exit(1);
});
