const fs = require("fs");
const path = require("path");

const projectRoot = "G:\\GITHUB\\wix-test\\hd-origin-project";
const outFile = "G:\\GITHUB\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\memo\\payment_document_fix_public_utility_direct_result_20260708_014805.txt";

process.chdir(projectRoot);

require(path.join(projectRoot, "web_receiver", "src", "config.js"));
const db = require(path.join(projectRoot, "web_receiver", "src", "db.js"));

async function main() {
  const lines = [];

  lines.push("==============================");
  lines.push("public_utility_label 直接補正結果");
  lines.push("==============================");
  lines.push("日時: " + new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
  lines.push("");

  const updateResult = await db.query(
    UPDATE accounting.payment_document_sorting_drafts
    SET
      public_utility_label = '対象外',
      updated_at = NOW()
    WHERE deleted_at IS NULL
      AND is_current = TRUE
      AND COALESCE(public_utility_label, '') = '公共料金'
      AND COALESCE(document_type_code, '') NOT IN ('utility_notice', 'utility_bill', 'public_utility')
      AND COALESCE(document_type_label, '') NOT LIKE '%公共料金%'
      AND COALESCE(document_type_label, '') NOT LIKE '%水道料金%'
      AND COALESCE(document_type_label, '') NOT LIKE '%電気料金%'
      AND COALESCE(document_type_label, '') NOT LIKE '%ガス料金%'
      AND COALESCE(document_type_label, '') NOT LIKE '%通信費%'
    RETURNING
      payment_document_sorting_draft_id,
      payment_document_ocr_import_id,
      document_type_label,
      payment_destination_label,
      accounting_category_label,
      payable_kind_label,
      specialist_route_label,
      public_utility_label
  );

  lines.push("[補正件数]");
  lines.push(String(updateResult.rowCount));
  lines.push("");

  for (const row of updateResult.rows) {
    lines.push("---- 補正 OCR ID: " + row.payment_document_ocr_import_id + " ----");
    lines.push("draft_id: " + row.payment_document_sorting_draft_id);
    lines.push("document_type_label: " + row.document_type_label);
    lines.push("payment_destination_label: " + row.payment_destination_label);
    lines.push("accounting_category_label: " + row.accounting_category_label);
    lines.push("payable_kind_label: " + row.payable_kind_label);
    lines.push("specialist_route_label: " + row.specialist_route_label);
    lines.push("public_utility_label: " + row.public_utility_label);
    lines.push("");
  }

  const checkResult = await db.query(
    SELECT
      payment_document_sorting_draft_id,
      payment_document_ocr_import_id,
      document_type_label,
      payment_destination_label,
      accounting_category_label,
      payable_kind_label,
      specialist_route_label,
      public_utility_label,
      ai_reason
    FROM accounting.payment_document_sorting_drafts
    WHERE deleted_at IS NULL
      AND is_current = TRUE
    ORDER BY payment_document_ocr_import_id
  );

  lines.push("");
  lines.push("[現在の仕分け下書き]");
  lines.push("");

  for (const row of checkResult.rows) {
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

  await db.end();
  fs.writeFileSync(outFile, lines.join("\r\n"), "utf8");
}

main().catch(async err => {
  fs.writeFileSync(outFile, String(err.stack || err.message || err), "utf8");
  try { await db.end(); } catch {}
  process.exitCode = 1;
});