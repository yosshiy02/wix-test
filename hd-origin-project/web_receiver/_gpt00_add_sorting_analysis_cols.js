const db = require("./src/db");

async function query(sql, params) {
  if (typeof db.query === "function") {
    return await db.query(sql, params || []);
  }

  if (db.pool && typeof db.pool.query === "function") {
    return await db.pool.query(sql, params || []);
  }

  throw new Error("db.query / db.pool.query が見つかりません。");
}

async function closeDb() {
  if (db.pool && typeof db.pool.end === "function") {
    await db.pool.end();
  }
}

async function main() {
  console.log("START: payment_document_sorting_drafts analysis_system columns fix");

  const tableCheck = await query(`
    SELECT to_regclass('accounting.payment_document_sorting_drafts') AS table_name;
  `);

  const tableName = tableCheck.rows && tableCheck.rows[0] && tableCheck.rows[0].table_name;

  if (!tableName) {
    console.log("ERROR: accounting.payment_document_sorting_drafts が見つかりません。");

    const tables = await query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name ILIKE '%payment_document%'
      ORDER BY table_schema, table_name;
    `);

    console.log("payment_document 関連テーブル:");
    console.log(JSON.stringify(tables.rows, null, 2));

    throw new Error("保存先テーブル accounting.payment_document_sorting_drafts が存在しません。");
  }

  console.log("TABLE OK:", tableName);

  const alters = [
    "ALTER TABLE accounting.payment_document_sorting_drafts ADD COLUMN IF NOT EXISTS analysis_system_code text;",
    "ALTER TABLE accounting.payment_document_sorting_drafts ADD COLUMN IF NOT EXISTS analysis_system_label text;",
    "ALTER TABLE accounting.payment_document_sorting_drafts ADD COLUMN IF NOT EXISTS analysis_system_reason text;",
    "ALTER TABLE accounting.payment_document_sorting_drafts ADD COLUMN IF NOT EXISTS analysis_system_confidence text;"
  ];

  for (const sql of alters) {
    console.log("RUN:", sql);
    await query(sql);
  }

  const result = await query(`
    SELECT column_name, data_type
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
  `);

  console.log("COLUMNS:");
  console.log(JSON.stringify(result.rows, null, 2));

  if (!result.rows || result.rows.length !== 4) {
    throw new Error("analysis_system_* 4列の確認に失敗しました。確認できた列数: " + (result.rows ? result.rows.length : 0));
  }

  console.log("OK: analysis_system_* 4列を追加・確認しました。");
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async err => {
    console.error("ERROR:", err && err.stack ? err.stack : err);
    await closeDb().catch(() => {});
    process.exit(1);
  });
