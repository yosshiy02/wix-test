const fs = require("fs");
const path = require("path");

const projectRoot = process.argv[2];
const migrationPath = process.argv[3];
const checkResultPath = process.argv[4];

const webDir = path.join(projectRoot, "web_receiver");
process.chdir(webDir);

const db = require(path.join(webDir, "src", "db"));

async function main() {
  const sql = fs.readFileSync(migrationPath, "utf8").replace(/^\uFEFF/, "");
  await db.query(sql);

  const tables = [
    "contract_insurance_lease_kinds",
    "insurance_types",
    "lease_item_categories",
    "contract_types",
    "contract_statuses",
    "payment_statuses",
    "payment_cycles",
    "company_burden_types",
    "personal_mix_flags",
    "payable_registration_types",
    "accounts_payable_registration_types",
    "auto_renewal_types",
    "ownership_transfer_types",
    "early_cancellation_types"
  ];

  const lines = [];
  lines.push("==============================");
  lines.push("契約・保険・リース 不足マスタ14個 作成確認");
  lines.push("==============================");
  lines.push("日時: " + new Date().toISOString());
  lines.push("");

  for (const tableName of tables) {
    const exists = await db.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = 'expenses'
        AND table_name = $1
    `, [tableName]);

    const count = await db.query(`
      SELECT COUNT(*)::text AS count
      FROM expenses."${tableName}"
    `);

    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'expenses'
        AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    lines.push("");
    lines.push("========================================");
    lines.push(`expenses.${tableName}`);
    lines.push("========================================");
    lines.push(`exists=${exists.rows.length > 0 ? "yes" : "no"}`);
    lines.push(`count=${count.rows[0].count}`);
    lines.push("[columns]");
    for (const row of columns.rows) {
      lines.push(`${row.column_name} / ${row.data_type} / nullable=${row.is_nullable}`);
    }
  }

  fs.writeFileSync(checkResultPath, lines.join("\r\n"), "utf8");
  await db.end();
}

main().catch(async err => {
  fs.writeFileSync(checkResultPath, String(err && err.stack ? err.stack : err), "utf8");
  try { await db.end(); } catch {}
  process.exit(1);
});