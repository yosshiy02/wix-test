const fs = require("fs");
const path = require("path");

const projectRoot = "G:\\GITHUB\\wix-test\\hd-origin-project";
const outFile = "G:\\GITHUB\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\memo\\check_payment_sorting_drafts_db_result_20260708_015646.txt";

process.chdir(projectRoot);

require(path.join(projectRoot, "web_receiver", "src", "config.js"));
const db = require(path.join(projectRoot, "web_receiver", "src", "db.js"));

function v(x) {
  return x === null || x === undefined ? "" : String(x);
}

async function main() {
  const lines = [];

  lines.push("==============================");
  lines.push("支払書類 下書き保存DB 中身確認");
  lines.push("==============================");
  lines.push("日時: " + new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
  lines.push("");

  const count = await db.query(
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_current = TRUE)::int AS current_count,
      COUNT(*) FILTER (WHERE draft_status = 'draft_saved')::int AS draft_saved_count
    FROM accounting.payment_document_sorting_drafts
    WHERE deleted_at IS NULL
  );

  lines.push("[件数]");
  lines.push("下書き全件: " + count.rows[0].total);
  lines.push("現在有効: " + count.rows[0].current_count);
  lines.push("draft_saved: " + count.rows[0].draft_saved_count);
  lines.push("");

  const rows = await db.query(
    SELECT
      d.payment_document_sorting_draft_id,
      d.payment_document_ocr_import_id,
      o.original_file_name,
      o.saved_file_name,
      o.latest_sorting_draft_id,
      o.draft_status AS ocr_draft_status,
      o.sorted_at,

      d.draft_no,
      d.draft_status,
      d.human_check_status,
      d.is_current,

      d.document_type_code,
      d.document_type_label,
      d.payment_destination_code,
      d.payment_destination_label,
      d.accounting_category_code,
      d.accounting_category_label,
      d.payable_kind_code,
      d.payable_kind_label,
      d.specialist_route_code,
      d.specialist_route_label,

      d.payment_target_label,
      d.payable_target_label,
      d.expense_target_label,
      d.tax_public_label,
      d.public_utility_label,
      d.contract_insurance_lease_label,

      d.ai_confidence_label,
      d.ai_reason,
      d.review_reason,
      d.created_at,
      d.updated_at
    FROM accounting.payment_document_sorting_drafts d
    LEFT JOIN accounting.payment_document_ocr_imports o
      ON o.payment_document_ocr_import_id = d.payment_document_ocr_import_id
     AND o.deleted_at IS NULL
    WHERE d.deleted_at IS NULL
    ORDER BY d.payment_document_ocr_import_id, d.payment_document_sorting_draft_id
  );

  let ng = 0;

  lines.push("[下書き保存 全データ]");
  lines.push("");

  for (const r of rows.rows) {
    const file = v(r.saved_file_name || r.original_file_name);
    const latestOk = String(r.latest_sorting_draft_id || "") === String(r.payment_document_sorting_draft_id || "");

    const text = [
      r.document_type_label,
      r.payment_destination_label,
      r.accounting_category_label,
      r.payable_kind_label,
      r.specialist_route_label,
      r.public_utility_label,
      r.contract_insurance_lease_label,
      r.ai_reason,
      file
    ].map(v).join(" ");

    const isUtility =
      text.includes("水道料金") ||
      text.includes("電気料金") ||
      text.includes("ガス料金") ||
      text.includes("通信費") ||
      text.includes("電話料金") ||
      text.includes("インターネット") ||
      text.includes("プロバイダ");

    const isNonUtility =
      text.includes("リース") ||
      text.includes("保険") ||
      text.includes("契約・保険・リース") ||
      text.includes("納付書") ||
      text.includes("納税") ||
      text.includes("法人税") ||
      text.includes("固定資産税") ||
      text.includes("カード") ||
      text.includes("材料仕入") ||
      text.includes("靴資材") ||
      text.includes("買掛");

    const problems = [];

    if (!latestOk) problems.push("NG: ocr_imports.latest_sorting_draft_id と不一致");
    if (r.is_current !== true) problems.push("確認: is_current が TRUE ではない");
    if (v(r.draft_status) !== "draft_saved") problems.push("確認: draft_status が draft_saved ではない");

    if (isNonUtility && v(r.public_utility_label) === "公共料金") {
      problems.push("NG: 非公共料金系なのに public_utility_label=公共料金");
    }

    if (isUtility && v(r.public_utility_label) !== "公共料金") {
      problems.push("確認: 公共料金系なのに public_utility_label が公共料金ではない");
    }

    if (problems.some(p => p.startsWith("NG:"))) ng++;

    lines.push("--------------------------------------------------");
    lines.push("OCR ID: " + v(r.payment_document_ocr_import_id));
    lines.push("draft_id: " + v(r.payment_document_sorting_draft_id));
    lines.push("file: " + file);
    lines.push("latest_sorting_draft_id: " + v(r.latest_sorting_draft_id) + " / 一致: " + (latestOk ? "OK" : "NG"));
    lines.push("draft_status: " + v(r.draft_status));
    lines.push("ocr_draft_status: " + v(r.ocr_draft_status));
    lines.push("human_check_status: " + v(r.human_check_status));
    lines.push("is_current: " + v(r.is_current));
    lines.push("");
    lines.push("書類区分: " + v(r.document_type_label) + " / " + v(r.document_type_code));
    lines.push("処理先: " + v(r.payment_destination_label) + " / " + v(r.payment_destination_code));
    lines.push("会計区分: " + v(r.accounting_category_label) + " / " + v(r.accounting_category_code));
    lines.push("未払種別: " + v(r.payable_kind_label) + " / " + v(r.payable_kind_code));
    lines.push("専門ルート: " + v(r.specialist_route_label) + " / " + v(r.specialist_route_code));
    lines.push("");
    lines.push("支払対象: " + v(r.payment_target_label));
    lines.push("未払登録対象: " + v(r.payable_target_label));
    lines.push("経費登録対象: " + v(r.expense_target_label));
    lines.push("税金・公的支払: " + v(r.tax_public_label));
    lines.push("公共料金・通信費: " + v(r.public_utility_label));
    lines.push("契約・保険・リース: " + v(r.contract_insurance_lease_label));
    lines.push("");
    lines.push("AI信頼度: " + v(r.ai_confidence_label));
    lines.push("AI理由: " + v(r.ai_reason));
    lines.push("updated_at: " + v(r.updated_at));

    if (problems.length > 0) {
      lines.push("");
      lines.push("判定:");
      for (const p of problems) lines.push(" - " + p);
    } else {
      lines.push("");
      lines.push("判定: OK");
    }

    lines.push("");
  }

  lines.push("==============================");
  lines.push("総合判定");
  lines.push("==============================");
  lines.push("NG件数: " + ng);
  lines.push("確認対象件数: " + rows.rows.length);
  lines.push("");
  lines.push("見るべき結論:");
  lines.push("- NG件数が0なら、下書き保存DBはひとまずOK");
  lines.push("- リース・保険の 公共料金・通信費 が 対象外 ならOK");
  lines.push("- 水道・電気・通信費の 公共料金・通信費 が 公共料金 ならOK");

  await db.end();
  fs.writeFileSync(outFile, lines.join("\r\n"), "utf8");
}

main().catch(async err => {
  fs.writeFileSync(outFile, String(err.stack || err.message || err), "utf8");
  try { await db.end(); } catch {}
  process.exitCode = 1;
});