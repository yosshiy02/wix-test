const db = require("G:\\GITHUB\\wix-test\\hd-origin-project\\web_receiver\\src\\db.js");

async function main() {
  await db.query(
    ALTER TABLE accounting.payment_document_sorting_drafts
      ADD COLUMN IF NOT EXISTS analysis_system_code text,
      ADD COLUMN IF NOT EXISTS analysis_system_label text,
      ADD COLUMN IF NOT EXISTS analysis_system_reason text,
      ADD COLUMN IF NOT EXISTS analysis_system_confidence text;
  );

  const result = await db.query(
    SELECT
      column_name,
      data_type
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'payment_document_sorting_drafts'
      AND column_name IN (
        'analysis_system_code',
        'analysis_system_label',
        'analysis_system_reason',
        'analysis_system_confidence'
      )
    ORDER BY column_name;
  );

  console.log("OK: payment_document_sorting_drafts に analysis_system_* 列を確認しました。");
  console.log(JSON.stringify(result.rows, null, 2));

  if (db.pool && typeof db.pool.end === "function") {
    await db.pool.end();
  }
}

main().catch(async err => {
  console.error("ERROR:", err && err.message ? err.message : String(err));

  try {
    if (db.pool && typeof db.pool.end === "function") {
      await db.pool.end();
    }
  } catch {}

  process.exit(1);
});
