const path = require("path");

const projectRoot = "G:\\GITHUB\\wix-test\\hd-origin-project";
process.chdir(projectRoot);

require(path.join(projectRoot, "web_receiver", "src", "config.js"));
const db = require(path.join(projectRoot, "web_receiver", "src", "db.js"));

function v(x) {
  return x === null || x === undefined ? "" : String(x);
}

async function main() {
  const rows = await db.query(
    SELECT
      d.payment_document_sorting_draft_id AS draft_id,
      d.payment_document_ocr_import_id AS ocr_id,
      o.original_file_name,
      o.saved_file_name,
      o.latest_sorting_draft_id,

      d.draft_status,
      d.human_check_status,
      d.is_current,

      d.document_type_label,
      d.payment_destination_label,
      d.accounting_category_label,
      d.payable_kind_label,
      d.specialist_route_label,

      d.payment_target_label,
      d.payable_target_label,
      d.expense_target_label,
      d.tax_public_label,
      d.public_utility_label,
      d.contract_insurance_lease_label,

      d.ai_confidence_label,
      d.ai_reason,
      d.updated_at
    FROM accounting.payment_document_sorting_drafts d
    LEFT JOIN accounting.payment_document_ocr_imports o
      ON o.payment_document_ocr_import_id = d.payment_document_ocr_import_id
     AND o.deleted_at IS NULL
    WHERE d.deleted_at IS NULL
      AND d.is_current = TRUE
    ORDER BY d.payment_document_ocr_import_id
  );

  let ng = 0;

  console.log("==============================");
  console.log("支払書類 下書き保存DB 直接確認");
  console.log("==============================");
  console.log("件数: " + rows.rows.length);
  console.log("");

  for (const r of rows.rows) {
    const file = v(r.saved_file_name || r.original_file_name);
    const publicUtility = v(r.public_utility_label);

    const text = [
      file,
      r.document_type_label,
      r.payment_destination_label,
      r.accounting_category_label,
      r.payable_kind_label,
      r.specialist_route_label,
      r.public_utility_label,
      r.contract_insurance_lease_label,
      r.ai_reason
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

    const latestOk = String(r.latest_sorting_draft_id || "") === String(r.draft_id || "");

    const problems = [];

    if (!latestOk) problems.push("NG: latest_sorting_draft_id不一致");
    if (isNonUtility && publicUtility === "公共料金") problems.push("NG: 非公共料金なのに公共料金");
    if (isUtility && publicUtility !== "公共料金") problems.push("確認: 公共料金系なのに公共料金ではない");

    if (problems.some(p => p.startsWith("NG:"))) ng++;

    console.log("--------------------------------------------------");
    console.log("OCR ID: " + v(r.ocr_id) + " / draft_id: " + v(r.draft_id));
    console.log("file: " + file);
    console.log("latest一致: " + (latestOk ? "OK" : "NG"));
    console.log("draft_status: " + v(r.draft_status));
    console.log("human_check_status: " + v(r.human_check_status));
    console.log("");
    console.log("書類区分: " + v(r.document_type_label));
    console.log("処理先: " + v(r.payment_destination_label));
    console.log("会計区分: " + v(r.accounting_category_label));
    console.log("未払種別: " + v(r.payable_kind_label));
    console.log("専門ルート: " + v(r.specialist_route_label));
    console.log("");
    console.log("支払対象: " + v(r.payment_target_label));
    console.log("未払登録対象: " + v(r.payable_target_label));
    console.log("経費登録対象: " + v(r.expense_target_label));
    console.log("税金・公的支払: " + v(r.tax_public_label));
    console.log("公共料金・通信費: " + v(r.public_utility_label));
    console.log("契約・保険・リース: " + v(r.contract_insurance_lease_label));
    console.log("");
    console.log("AI信頼度: " + v(r.ai_confidence_label));
    console.log("AI理由: " + v(r.ai_reason));

    if (problems.length) {
      console.log("");
      console.log("判定:");
      for (const p of problems) console.log(" - " + p);
    } else {
      console.log("");
      console.log("判定: OK");
    }

    console.log("");
  }

  console.log("==============================");
  console.log("総合判定");
  console.log("==============================");
  console.log("NG件数: " + ng);

  await db.end();
}

main().catch(async err => {
  console.error(err.stack || err.message || err);
  try { await db.end(); } catch {}
  process.exitCode = 1;
});