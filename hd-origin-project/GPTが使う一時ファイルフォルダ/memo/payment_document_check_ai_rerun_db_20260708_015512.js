const fs = require("fs");
const path = require("path");

const projectRoot = "G:\\GITHUB\\wix-test\\hd-origin-project";
const outFile = "G:\\GITHUB\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\memo\\payment_document_check_ai_rerun_db_result_20260708_015512.txt";

process.chdir(projectRoot);

require(path.join(projectRoot, "web_receiver", "src", "config.js"));
const db = require(path.join(projectRoot, "web_receiver", "src", "db.js"));

function s(v) {
  return v === null || v === undefined ? "" : String(v);
}

function hasAny(text, words) {
  const t = s(text);
  return words.some(w => t.includes(w));
}

function rowText(row) {
  return [
    row.original_file_name,
    row.saved_file_name,
    row.document_type_label,
    row.payment_destination_label,
    row.accounting_category_label,
    row.payable_kind_label,
    row.specialist_route_label,
    row.public_utility_label,
    row.ai_reason
  ].map(s).join(" ");
}

function judge(row) {
  const text = rowText(row);

  const isUtility =
    hasAny(text, ["水道料金", "電気料金", "ガス料金", "通信費", "電話料金", "インターネット", "プロバイダ"]);

  const isContractInsuranceLease =
    hasAny(text, ["リース契約書", "リース", "保険料通知書", "保険", "契約書", "契約・保険・リース"]);

  const isTax =
    hasAny(text, ["納付書", "納税通知書", "法人税", "固定資産税", "都市計画税", "税務署", "市税"]);

  const isCard =
    hasAny(text, ["カード利用明細", "カード明細", "カード未払"]);

  const isInvoicePayable =
    hasAny(text, ["請求書", "材料仕入", "靴資材", "買掛", "仕入買掛"]);

  const publicUtility = s(row.public_utility_label);

  const issues = [];

  if (!row.latest_sorting_draft_id) {
    issues.push("latest_sorting_draft_idなし");
  }

  if (!row.sorting_draft_id) {
    issues.push("最新仕分け下書きJOINなし");
  }

  if (isContractInsuranceLease && publicUtility === "公共料金") {
    issues.push("NG: 契約・保険・リース系なのに public_utility_label=公共料金");
  }

  if ((isTax || isCard || isInvoicePayable) && publicUtility === "公共料金") {
    issues.push("NG: 非公共料金系なのに public_utility_label=公共料金");
  }

  if (isUtility && publicUtility !== "公共料金") {
    issues.push("確認: 公共料金系なのに public_utility_label が公共料金ではない");
  }

  return {
    isUtility,
    isContractInsuranceLease,
    isTax,
    isCard,
    isInvoicePayable,
    issues
  };
}

async function main() {
  const result = await db.query(
    SELECT
      o.payment_document_ocr_import_id,
      o.original_file_name,
      o.saved_file_name,
      o.ocr_status,
      o.draft_status AS ocr_draft_status,
      o.latest_sorting_draft_id,
      o.sorted_at,

      d.payment_document_sorting_draft_id AS sorting_draft_id,
      d.draft_status AS sorting_draft_status,
      d.human_check_status,

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
      d.needs_review,
      d.updated_at AS sorting_updated_at
    FROM accounting.payment_document_ocr_imports o
    LEFT JOIN accounting.payment_document_sorting_drafts d
      ON d.payment_document_sorting_draft_id = o.latest_sorting_draft_id
     AND d.deleted_at IS NULL
    WHERE o.deleted_at IS NULL
    ORDER BY o.payment_document_ocr_import_id
  );

  const lines = [];
  const ngRows = [];
  const confirmRows = [];

  lines.push("==============================");
  lines.push("AI再解析後 DB全件確認");
  lines.push("==============================");
  lines.push("日時: " + new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
  lines.push("");
  lines.push("[件数]");
  lines.push("OCR取込DB件数: " + result.rows.length);
  lines.push("最新仕分け下書きJOINあり: " + result.rows.filter(r => r.sorting_draft_id).length);
  lines.push("");

  for (const row of result.rows) {
    const j = judge(row);

    if (j.issues.some(x => x.startsWith("NG:"))) {
      ngRows.push({ row, issues: j.issues });
    } else if (j.issues.length > 0) {
      confirmRows.push({ row, issues: j.issues });
    }

    lines.push("--------------------------------------------------");
    lines.push("OCR ID: " + row.payment_document_ocr_import_id);
    lines.push("file: " + s(row.saved_file_name || row.original_file_name));
    lines.push("ocr_status: " + s(row.ocr_status));
    lines.push("ocr_draft_status: " + s(row.ocr_draft_status));
    lines.push("latest_sorting_draft_id: " + s(row.latest_sorting_draft_id));
    lines.push("sorting_draft_id: " + s(row.sorting_draft_id));
    lines.push("sorting_draft_status: " + s(row.sorting_draft_status));
    lines.push("human_check_status: " + s(row.human_check_status));
    lines.push("");
    lines.push("書類区分: " + s(row.document_type_label) + " / code=" + s(row.document_type_code));
    lines.push("処理先: " + s(row.payment_destination_label) + " / code=" + s(row.payment_destination_code));
    lines.push("会計区分: " + s(row.accounting_category_label) + " / code=" + s(row.accounting_category_code));
    lines.push("未払種別: " + s(row.payable_kind_label) + " / code=" + s(row.payable_kind_code));
    lines.push("専門ルート: " + s(row.specialist_route_label) + " / code=" + s(row.specialist_route_code));
    lines.push("");
    lines.push("支払対象: " + s(row.payment_target_label));
    lines.push("未払登録対象: " + s(row.payable_target_label));
    lines.push("経費登録対象: " + s(row.expense_target_label));
    lines.push("税金・公的支払: " + s(row.tax_public_label));
    lines.push("公共料金・通信費: " + s(row.public_utility_label));
    lines.push("契約・保険・リース: " + s(row.contract_insurance_lease_label));
    lines.push("");
    lines.push("AI信頼度: " + s(row.ai_confidence_label));
    lines.push("AI理由: " + s(row.ai_reason));
    lines.push("updated_at: " + s(row.sorting_updated_at));

    if (j.issues.length > 0) {
      lines.push("");
      lines.push("判定:");
      for (const issue of j.issues) {
        lines.push(" - " + issue);
      }
    } else {
      lines.push("");
      lines.push("判定: OK");
    }

    lines.push("");
  }

  lines.push("");
  lines.push("==============================");
  lines.push("総合判定");
  lines.push("==============================");
  lines.push("NG件数: " + ngRows.length);
  lines.push("確認件数: " + confirmRows.length);
  lines.push("");

  if (ngRows.length > 0) {
    lines.push("[NG一覧]");
    for (const item of ngRows) {
      const row = item.row;
      lines.push("OCR ID " + row.payment_document_ocr_import_id + " / " + s(row.saved_file_name || row.original_file_name));
      for (const issue of item.issues) lines.push(" - " + issue);
      lines.push("");
    }
  } else {
    lines.push("[NG一覧]");
    lines.push("なし");
    lines.push("");
  }

  if (confirmRows.length > 0) {
    lines.push("[確認一覧]");
    for (const item of confirmRows) {
      const row = item.row;
      lines.push("OCR ID " + row.payment_document_ocr_import_id + " / " + s(row.saved_file_name || row.original_file_name));
      for (const issue of item.issues) lines.push(" - " + issue);
      lines.push("");
    }
  } else {
    lines.push("[確認一覧]");
    lines.push("なし");
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