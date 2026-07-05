const fs = require("fs");
const path = require("path");
const pool = require("./src/db");

(async () => {
  const r = await pool.query(`
    SELECT purpose_id, purpose_name, sort_order, is_active
    FROM expenses.purposes
    WHERE is_active = TRUE
    ORDER BY sort_order, purpose_id
  `);

  const lines = [];
  lines.push("PURPOSE MASTER ACTIVE CHECK");
  lines.push("===========================");
  for (const row of r.rows) {
    lines.push(`${row.sort_order}: ${row.purpose_id} ${row.purpose_name}`);
  }

  const out = path.join(process.cwd(), "_purpose_master_check_result.txt");
  fs.writeFileSync(out, lines.join("\n"), "utf8");

  console.log("OK");
  console.log(out);

  await pool.end();
})().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
