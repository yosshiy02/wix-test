const fs = require("fs");
const path = require("path");

async function main() {
  const webReceiver = process.cwd();
  const projectRoot = path.dirname(webReceiver);
  const sqlPath = path.join(projectRoot, "database", "migrations", "20260708_004_payment_document_sorting_drafts_analysis_system_columns.sql");

  const dbModulePath = path.join(webReceiver, "src", "db.js");
  const db = require(dbModulePath);

  function pickQuery(mod) {
    const candidates = [
      mod,
      mod && mod.pool,
      mod && mod.client,
      mod && mod.db,
      mod && mod.database,
      mod && mod.default,
      mod && mod.default && mod.default.pool
    ];

    for (const c of candidates) {
      if (c && typeof c.query === "function") {
        return { query: c.query.bind(c), holder: c };
      }
    }

    if (typeof mod === "function") {
      return { query: mod, holder: mod };
    }

    throw new Error("db.js から query 関数を見つけられませんでした。");
  }

  async function closeDb(mod, holder) {
    const candidates = [
      holder,
      mod,
      mod && mod.pool,
      mod && mod.client,
      mod && mod.db,
      mod && mod.database,
      mod && mod.default,
      mod && mod.default && mod.default.pool
    ];

    for (const c of candidates) {
      if (c && typeof c.end === "function") {
        try { await c.end(); } catch (_) {}
        return;
      }
    }
  }

  const { query, holder } = pickQuery(db);
  const sql = fs.readFileSync(sqlPath, "utf8");

  console.log("==============================");
  console.log("analysis_system_* DB列追加 実行");
  console.log("==============================");
  console.log("[SQL]");
  console.log(sqlPath);
  console.log("");

  await query(sql);

  const verify = await query(`
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

  console.log("[列確認]");
  for (const row of verify.rows || []) {
    console.log(`${row.column_name}: ${row.data_type}`);
  }

  console.log("");
  console.log("[結果]");
  if ((verify.rows || []).length === 4) {
    console.log("OK: analysis_system_* 4列を確認しました。");
  } else {
    console.log(`NG: 確認できた列数が ${verify.rows.length} です。`);
    process.exitCode = 1;
  }

  await closeDb(db, holder);
}

main().catch((err) => {
  console.error("[ERROR]");
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});