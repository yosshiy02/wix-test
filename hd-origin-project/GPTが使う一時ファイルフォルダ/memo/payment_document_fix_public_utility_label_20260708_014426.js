const fs = require("fs");
const path = require("path");

const projectRoot = "G:\\GITHUB\\wix-test\\hd-origin-project";
const sqlFile = "G:\\GITHUB\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\memo\\payment_document_fix_public_utility_label_20260708_014426.sql";
const outFile = "G:\\GITHUB\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\memo\\payment_document_fix_public_utility_label_20260708_014426.txt";

process.chdir(projectRoot);

require(path.join(projectRoot, "web_receiver", "src", "config.js"));
const db = require(path.join(projectRoot, "web_receiver", "src", "db.js"));

async function main() {
  const sql = fs.readFileSync(sqlFile, "utf8");
  const result = await db.query(sql);

  const lines = [];
  lines.push("==============================");
  lines.push("公共料金誤フィールド補正 結果");
  lines.push("==============================");
  lines.push("日時: " + new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
  lines.push("");

  const selectResult = Array.isArray(result) ? result.find(r => r.rows) : result;

  if (selectResult && selectResult.rows) {
    for (const row of selectResult.rows) {
      lines.push("---- OCR ID: " + row.payment_document_ocr_import_id + " ----");
      lines.push("draft_id: " + row.payment_document_sorting_draft_id);
      lines.push("document_type_label: " + row.document_type_label);
      lines.push("payment_destination_label: " + row.payment_destination_label);
      lines.push("accounting_category_label: " + row.accounting_category_label);
      lines.push("payable_kind_label: " + row.payable_kind_label);
      lines.push("specialist_route_label: " + row.specialist_route_label);
      lines.push("public_utility_label: " + row.public_utility_label);
      lines.push("ai_reason: " + row.ai_reason);
      lines.push("");
    }
  }

  fs.writeFileSync(outFile, lines.join("\r\n"), "utf8");
  await db.end();
}

main().catch(async err => {
  fs.writeFileSync(outFile, String(err.stack || err.message || err), "utf8");
  try { await db.end(); } catch {}
  process.exitCode = 1;
});
