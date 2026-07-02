const { Client } = require("pg");
const config = require("./web_receiver/src/config");

async function main() {
  const client = new Client(config.db);
  await client.connect();

  console.log("\n[税処理マスタ]");
  const treatments = await client.query(`
    SELECT treatment_name, treatment_code, is_tax_included, sort_order
    FROM expenses.tax_treatments
    ORDER BY sort_order
  `);
  console.table(treatments.rows);

  console.log("\n[追加カラム確認]");
  const columns = await client.query(`
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE
      column_name ILIKE '%tax_treatment%'
    ORDER BY table_schema, table_name, ordinal_position
  `);
  console.table(columns.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});