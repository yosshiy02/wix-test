const fs = require("fs");
const path = require("path");

const projectRoot = "G:\\GITHUB\\wix-test\\hd-origin-project";
const out = "G:\\GITHUB\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\memo\\payment_document_db_saved_recheck_20260708_003418.txt";

process.chdir(projectRoot);

require(path.join(projectRoot, "web_receiver", "src", "config.js"));
const db = require(path.join(projectRoot, "web_receiver", "src", "db.js"));

const lines = [];

function line(value = "") {
  lines.push(String(value));
}

async function main() {
  line("==============================");
  line("支払書類 DB保存状態 再確認");
  line("==============================");
  line("日時: " + new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
  line("");

  const countSql = [
    "SELECT",
    "  (SELECT COUNT(*) FROM accounting.payment_document_sorting_drafts WHERE is_current = TRUE AND deleted_at IS NULL) AS current_sorting_drafts,",
    "  (SELECT COUNT(*) FROM accounting.payment_document_ocr_imports WHERE draft_status = 'draft_saved' AND latest_sorting_draft_id IS NOT NULL AND deleted_at IS NULL) AS ocr_imports_draft_saved"
  ].join(" ");

  const count = await db.query(countSql);
  line("[件数]");
  line("current_sorting_drafts: " + count.rows[0].current_sorting_drafts);
  line("ocr_imports_draft_saved: " + count.rows[0].ocr_imports_draft_saved);
  line("");

  const listSql = [
    "SELECT",
    "  o.payment_document_ocr_import_id,",
    "  o.original_file_name,",
    "  o.ocr_status,",
    "  o.draft_status,",
    "  o.latest_sorting_draft_id,",
    "  o.sorted_at,",
    "  d.payment_document_sorting_draft_id,",
    "  d.draft_status AS sorting_draft_status,",
    "  d.document_type_label,",
    "  d.payment_destination_label,",
    "  d.specialist_route_label,",
    "  d.ai_confidence_label,",
    "  d.created_at AS draft_created_at",
    "FROM accounting.payment_document_ocr_imports o",
    "LEFT JOIN accounting.payment_document_sorting_drafts d",
    "  ON d.payment_document_sorting_draft_id = o.latest_sorting_draft_id",
    "WHERE o.deleted_at IS NULL",
    "ORDER BY o.payment_document_ocr_import_id DESC",
    "LIMIT 20"
  ].join("\n");

  const list = await db.query(listSql);

  line("[最近のOCR取込と仕分け下書き]");
  for (const row of list.rows) {
    line("---- ocr_id: " + row.payment_document_ocr_import_id + " ----");
    line("file: " + row.original_file_name);
    line("ocr_status: " + row.ocr_status);
    line("ocr draft_status: " + row.draft_status);
    line("latest_sorting_draft_id: " + row.latest_sorting_draft_id);
    line("sorting_draft_id: " + row.payment_document_sorting_draft_id);
    line("sorting draft_status: " + row.sorting_draft_status);
    line("document_type_label: " + row.document_type_label);
    line("payment_destination_label: " + row.payment_destination_label);
    line("specialist_route_label: " + row.specialist_route_label);
    line("ai_confidence_label: " + row.ai_confidence_label);
    line("sorted_at: " + row.sorted_at);
    line("draft_created_at: " + row.draft_created_at);
    line("");
  }

  fs.writeFileSync(out, lines.join("\r\n"), "utf8");
  await db.end();
}

main().catch(async err => {
  line("");
  line("[ERROR]");
  line(err.stack || err.message || String(err));
  fs.writeFileSync(out, lines.join("\r\n"), "utf8");
  try { await db.end(); } catch {}
  process.exitCode = 1;
});
