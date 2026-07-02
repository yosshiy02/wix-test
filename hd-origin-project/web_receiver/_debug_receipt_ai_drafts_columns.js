const db = require("./src/db");

(async () => {
  try {
    console.log("checking table...");
    const table = await db.query(`
      SELECT to_regclass('accounting.receipt_ai_drafts') AS table_name;
    `);
    console.log(table.rows);

    console.log("checking columns...");
    const cols = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'accounting'
        AND table_name = 'receipt_ai_drafts'
      ORDER BY ordinal_position;
    `);
    console.table(cols.rows);

    console.log("adding columns...");
    await db.query(`
      ALTER TABLE accounting.receipt_ai_drafts
        ADD COLUMN IF NOT EXISTS vendor_address TEXT NOT NULL DEFAULT '';
    `);

    await db.query(`
      ALTER TABLE accounting.receipt_ai_drafts
        ADD COLUMN IF NOT EXISTS vendor_phone TEXT NOT NULL DEFAULT '';
    `);

    await db.query(`
      ALTER TABLE accounting.receipt_ai_drafts
        ADD COLUMN IF NOT EXISTS receipt_time_text TEXT NOT NULL DEFAULT '';
    `);

    console.log("OK");
  } catch (err) {
    console.error("ERROR NAME:", err.name);
    console.error("ERROR MESSAGE:", err.message);
    console.error("ERROR CODE:", err.code);
    console.error("ERROR DETAIL:", err.detail);
    console.error("ERROR STACK:", err.stack);
    process.exit(1);
  } finally {
    if (db.end) {
      await db.end();
    }
  }
})();