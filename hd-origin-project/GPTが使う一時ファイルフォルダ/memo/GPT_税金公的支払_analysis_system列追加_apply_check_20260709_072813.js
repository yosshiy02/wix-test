const fs = require("fs");
const path = require("path");
const projectRoot = process.cwd();
const outPath = process.argv[2];
const db = require(path.join(projectRoot, "web_receiver", "src", "db"));

(async () => {
  const lines = [];
  lines.push("==============================");
  lines.push("analysis_system_* 列追加 apply 結果");
  lines.push("==============================");
  lines.push("日時: " + new Date().toLocaleString("ja-JP"));
  lines.push("");

  const sql = fs.readFileSync(path.join(projectRoot, "database", "migrations", "20260709_001_payment_document_sorting_drafts_analysis_system_columns.sql"), "utf8");
  await db.query(sql);

  const result = await db.query(
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
    ORDER BY column_name
  );

  lines.push("[追加後の列確認]");
  for (const row of result.rows) {
    lines.push("- " + row.column_name + " : " + row.data_type);
  }

  if (result.rows.length !== 4) {
    throw new Error("analysis_system_* 4列の確認に失敗しました。確認できた列数: " + result.rows.length);
  }

  fs.writeFileSync(outPath, lines.join("\r\n"), "utf8");
  await db.end?.();
})().catch(async err => {
  fs.writeFileSync(outPath, "ERROR:\r\n" + (err && err.stack ? err.stack : String(err)), "utf8");
  try { await db.end?.(); } catch {}
  process.exit(1);
});
