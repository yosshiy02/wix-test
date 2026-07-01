const pool = require("./src/db");

(async () => {
  const result = await pool.query(`
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'receipt_imports'
    ORDER BY ordinal_position
  `);

  console.table(result.rows);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
