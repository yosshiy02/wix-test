const db = require("../../web_receiver/src/db");

(async () => {
  try {
    const table = await db.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'accounting'
          AND table_name = 'payment_document_contract_insurance_lease_drafts'
      ) AS exists
    `);

    const exists = !!(table.rows[0] && table.rows[0].exists);
    console.log("table_exists=" + exists);

    if (exists) {
      const cols = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'accounting'
          AND table_name = 'payment_document_contract_insurance_lease_drafts'
        ORDER BY ordinal_position
      `);
      console.log("column_count=" + cols.rows.length);

      const count = await db.query(`
        SELECT count(*)::int AS count
        FROM accounting.payment_document_contract_insurance_lease_drafts
        WHERE deleted_at IS NULL
      `);
      console.log("draft_count=" + count.rows[0].count);
    }

    await db.end?.();
    process.exit(0);
  } catch (err) {
    console.log("db_error=" + (err && err.message ? err.message : String(err)));
    try { await db.end?.(); } catch {}
    process.exit(0);
  }
})();
