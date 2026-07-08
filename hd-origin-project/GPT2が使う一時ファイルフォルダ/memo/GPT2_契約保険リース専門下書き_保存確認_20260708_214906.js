const path = require("path");
const fs = require("fs");

const projectRoot = process.argv[2];
const resultPath = process.argv[3];

const webDir = path.join(projectRoot, "web_receiver");
process.chdir(webDir);

const db = require(path.join(webDir, "src", "db"));

async function main() {
  const out = [];

  out.push("==============================");
  out.push("GPT2 契約・保険・リース専門下書き 保存確認");
  out.push("==============================");
  out.push("日時: " + new Date().toISOString());
  out.push("");

  const countResult = await db.query(`
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (WHERE is_current = TRUE)::int AS current_count
    FROM accounting.payment_document_contract_insurance_lease_drafts
    WHERE deleted_at IS NULL
  `);

  out.push("[件数]");
  out.push("total_count: " + countResult.rows[0].total_count);
  out.push("current_count: " + countResult.rows[0].current_count);
  out.push("");

  const latest = await db.query(`
    SELECT
      contract_insurance_lease_draft_id,
      payment_document_ocr_import_id,
      payment_document_sorting_draft_id,
      draft_no,
      is_current,
      draft_status,
      contract_insurance_lease_kind_code,
      contract_insurance_lease_kind_label,
      document_type_code,
      document_type_label,
      payment_destination_code,
      payment_destination_label,
      accounting_category_code,
      accounting_category_label,
      payable_kind_code,
      payable_kind_label,
      insurance_type_code,
      insurance_type_label,
      lease_item_name,
      lease_item_category_code,
      lease_item_category_label,
      contract_type_code,
      contract_type_label,
      contract_status_code,
      contract_status_label,
      payment_status_code,
      payment_status_label,
      payment_cycle_code,
      payment_cycle_label,
      company_burden_code,
      company_burden_label,
      mixed_personal_flag_code,
      mixed_personal_flag_label,
      payable_registration_code,
      payable_registration_label,
      accounts_payable_registration_code,
      accounts_payable_registration_label,
      created_at
    FROM accounting.payment_document_contract_insurance_lease_drafts
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC, contract_insurance_lease_draft_id DESC
    LIMIT 20
  `);

  out.push("[最新20件]");
  if (!latest.rows.length) {
    out.push("なし");
  } else {
    for (const row of latest.rows) {
      out.push("----------------------------------------");
      out.push("専門下書きID: " + row.contract_insurance_lease_draft_id);
      out.push("OCR取込ID: " + row.payment_document_ocr_import_id);
      out.push("仕分け下書きID: " + (row.payment_document_sorting_draft_id || ""));
      out.push("draft_no: " + (row.draft_no || ""));
      out.push("is_current: " + row.is_current);
      out.push("draft_status: " + (row.draft_status || ""));
      out.push("契約・保険・リース: " + (row.contract_insurance_lease_kind_code || "") + " / " + (row.contract_insurance_lease_kind_label || ""));
      out.push("書類区分: " + (row.document_type_code || "") + " / " + (row.document_type_label || ""));
      out.push("処理先: " + (row.payment_destination_code || "") + " / " + (row.payment_destination_label || ""));
      out.push("会計区分: " + (row.accounting_category_code || "") + " / " + (row.accounting_category_label || ""));
      out.push("未払種別: " + (row.payable_kind_code || "") + " / " + (row.payable_kind_label || ""));
      out.push("保険種類: " + (row.insurance_type_code || "") + " / " + (row.insurance_type_label || ""));
      out.push("リース物件: " + (row.lease_item_name || ""));
      out.push("リース物件区分: " + (row.lease_item_category_code || "") + " / " + (row.lease_item_category_label || ""));
      out.push("契約種別: " + (row.contract_type_code || "") + " / " + (row.contract_type_label || ""));
      out.push("契約ステータス: " + (row.contract_status_code || "") + " / " + (row.contract_status_label || ""));
      out.push("支払状態: " + (row.payment_status_code || "") + " / " + (row.payment_status_label || ""));
      out.push("支払周期: " + (row.payment_cycle_code || "") + " / " + (row.payment_cycle_label || ""));
      out.push("会社負担可否: " + (row.company_burden_code || "") + " / " + (row.company_burden_label || ""));
      out.push("個人負担混在: " + (row.mixed_personal_flag_code || "") + " / " + (row.mixed_personal_flag_label || ""));
      out.push("未払登録: " + (row.payable_registration_code || "") + " / " + (row.payable_registration_label || ""));
      out.push("買掛登録: " + (row.accounts_payable_registration_code || "") + " / " + (row.accounts_payable_registration_label || ""));
      out.push("created_at: " + row.created_at);
    }
  }

  fs.writeFileSync(resultPath, out.join("\r\n"), "utf8");

  await db.end();
}

main().catch(async err => {
  fs.writeFileSync(resultPath, String(err && err.stack ? err.stack : err), "utf8");
  try { await db.end(); } catch {}
  process.exit(1);
});