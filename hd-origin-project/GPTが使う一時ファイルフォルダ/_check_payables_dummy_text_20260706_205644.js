const fs = require("fs");
const path = require("path");
const projectRoot = process.argv[2];
const outPath = process.argv[3];
process.chdir(path.join(projectRoot, "web_receiver"));
require(path.join(projectRoot, "web_receiver", "src", "config"));
const db = require(path.join(projectRoot, "web_receiver", "src", "db"));
async function query(sql, params) {
  if (db && typeof db.query === "function") return db.query(sql, params);
  if (db && db.pool && typeof db.pool.query === "function") return db.pool.query(sql, params);
  throw new Error("db.query が見つかりません。");
}
async function closeDb() {
  if (db && db.pool && typeof db.pool.end === "function") {
    await db.pool.end();
    return;
  }
  if (db && typeof db.end === "function") {
    await db.end();
  }
}
function hasMojibake(value) {
  const s = String(value || "");
  return /繝|縺|譁|蜊|荳|髮|驕|蛯|邂|莠|�/.test(s);
}
async function main() {
  const result = await query(`
    SELECT
      payable_id,
      payable_no,
      vendor_name,
      summary,
      status,
      total_amount,
      paid_amount,
      balance_amount,
      due_date,
      source_memo
    FROM accounting.payable_documents
    WHERE source_memo LIKE 'HD_ORIGIN_PAYABLE_DUMMY_BATCH_%'
      AND deleted_at IS NULL
    ORDER BY payable_id
  `);
  const rows = result.rows || [];
  const badRows = rows.filter(row =>
    hasMojibake(row.vendor_name) ||
    hasMojibake(row.summary)
  );
  const lines = [];
  lines.push("==============================");
  lines.push("請求書・未払管理 ダミー文字化け DB本体確認");
  lines.push("==============================");
  lines.push("checked_at: " + new Date().toISOString());
  lines.push("");
  lines.push("[summary]");
  lines.push("dummy_rows: " + rows.length);
  lines.push("mojibake_candidate_rows: " + badRows.length);
  lines.push("");
  lines.push("[rows]");
  for (const row of rows) {
    lines.push("----------------------------------------");
    lines.push("payable_id: " + row.payable_id);
    lines.push("payable_no: " + row.payable_no);
    lines.push("vendor_name: " + row.vendor_name);
    lines.push("summary: " + row.summary);
    lines.push("status: " + row.status);
    lines.push("total_amount: " + row.total_amount);
    lines.push("paid_amount: " + row.paid_amount);
    lines.push("balance_amount: " + row.balance_amount);
    lines.push("due_date: " + row.due_date);
    lines.push("source_memo: " + row.source_memo);
  }
  lines.push("");
  lines.push("[judgement]");
  if (badRows.length === 0) {
    lines.push("OK: DB本体の文字は正常に見えます。前回メモ側の出力文字化けの可能性が高いです。");
  } else {
    lines.push("NG: DB本体にも文字化け候補があります。ダミーデータを削除して、英数字または安全な方法で入れ直した方がいいです。");
  }
  fs.writeFileSync(outPath, lines.join("\r\n"), "utf8");
  console.log(JSON.stringify({
    ok: true,
    outPath,
    dummy_rows: rows.length,
    mojibake_candidate_rows: badRows.length
  }, null, 2));
}
main()
  .catch(error => {
    fs.writeFileSync(outPath, String(error.stack || error.message || error), "utf8");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
