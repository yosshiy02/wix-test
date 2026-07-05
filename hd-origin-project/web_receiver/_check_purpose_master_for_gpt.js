const pool = require("./src/db");

(async () => {
  const r = await pool.query(`
    SELECT purpose_id, purpose_name, sort_order, is_active
    FROM expenses.purposes
    WHERE is_active = TRUE
    ORDER BY sort_order, purpose_id
  `);

  for (const row of r.rows) {
    console.log(`${row.sort_order}: ${row.purpose_id} ${row.purpose_name}`);
  }

  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
