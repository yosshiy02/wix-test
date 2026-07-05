const pool = require("./src/db");

(async () => {
  const a = await pool.query("SELECT COUNT(*)::int AS count FROM accounting.receipt_imports");
  const b = await pool.query("SELECT COUNT(*)::int AS count FROM accounting.receipt_ai_drafts");
  const c = await pool.query("SELECT COUNT(*)::int AS count FROM accounting.receipt_tax_breakdowns");

  console.table([
    { table: "receipt_imports", count: a.rows[0].count },
    { table: "receipt_ai_drafts", count: b.rows[0].count },
    { table: "receipt_tax_breakdowns", count: c.rows[0].count }
  ]);

  await pool.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
