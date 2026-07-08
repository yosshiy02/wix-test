const path = require("path");
const fs = require("fs");

const projectRoot = process.argv[2];
const resultPath = process.argv[3];
const port = process.argv[4] || "3000";

const webDir = path.join(projectRoot, "web_receiver");
process.chdir(webDir);

const db = require(path.join(webDir, "src", "db"));

function valueText(v) {
  return v === null || v === undefined ? "" : String(v);
}

async function main() {
  const out = [];

  out.push("==============================");
  out.push("GPT2 契約・保険・リース専門下書き 直接API保存 再テスト");
  out.push("==============================");
  out.push("日時: " + new Date().toISOString());
  out.push("");

  const before = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM accounting.payment_document_contract_insurance_lease_drafts
    WHERE deleted_at IS NULL
  `);

  out.push("[保存前件数]");
  out.push("count: " + before.rows[0].count);
  out.push("");

  const candidate = await db.query(`
    SELECT
      o.payment_document_ocr_import_id,
      o.latest_sorting_draft_id,
      o.original_file_name,
      o.saved_file_name,
      d.document_type_code,
      d.document_type_label,
      d.payment_destination_code,
      d.payment_destination_label,
      d.accounting_category_code,
      d.accounting_category_label,
      d.payable_kind_code,
      d.payable_kind_label,
      d.contract_insurance_lease_label,
      d.ai_confidence,
      d.ai_confidence_label,
      d.ai_reason,
      d.review_reason,
      d.ai_summary_json,
      d.sort_result_json,
      d.visible_fields_json,
      d.warnings_json
    FROM accounting.payment_document_ocr_imports o
    LEFT JOIN accounting.payment_document_sorting_drafts d
      ON d.payment_document_sorting_draft_id = o.latest_sorting_draft_id
     AND d.deleted_at IS NULL
    WHERE o.deleted_at IS NULL
      AND COALESCE(o.ocr_raw_text, '') <> ''
      AND (
        d.payment_destination_code = 'contract_insurance_lease'
        OR d.contract_insurance_lease_label IN ('契約', '保険', 'リース', '契約系')
        OR o.original_file_name ILIKE '%保険%'
        OR o.original_file_name ILIKE '%リース%'
        OR o.saved_file_name ILIKE '%保険%'
        OR o.saved_file_name ILIKE '%リース%'
      )
    ORDER BY
      o.saved_at DESC NULLS LAST,
      o.ocr_at DESC NULLS LAST,
      o.payment_document_ocr_import_id DESC
    LIMIT 1
  `);

  if (!candidate.rows.length) {
    out.push("[結果]");
    out.push("NG: 契約・保険・リース候補OCRが見つかりません。");
    fs.writeFileSync(resultPath, out.join("\r\n"), "utf8");
    await db.end();
    return;
  }

  const row = candidate.rows[0];

  const label =
    valueText(row.contract_insurance_lease_label) ||
    (valueText(row.document_type_code).includes("lease") ? "リース" : "") ||
    (valueText(row.document_type_code).includes("insurance") ? "保険" : "") ||
    "要確認";

  const baseFields =
    row.visible_fields_json && typeof row.visible_fields_json === "object"
      ? row.visible_fields_json
      : {};

  const fields = {
    ...baseFields,
    "契約・保険・リース": label,
    "書類名": valueText(row.original_file_name || row.saved_file_name),
    "支払状態": "unpaid",
    "会社負担可否": "company",
    "個人負担混在": "none",
    "未払登録": "register",
    "買掛登録": "not_register",
    "支払周期": "monthly",
    "要確認メモ": "GPT2直接API保存再テスト"
  };

  if (label.includes("保険")) {
    fields["保険種類"] = fields["保険種類"] || "other";
    fields["契約種別"] = fields["契約種別"] || "insurance_contract";
    fields["契約ステータス"] = fields["契約ステータス"] || "active";
  }

  if (label.includes("リース")) {
    fields["リース物件"] = fields["リース物件"] || "直接API保存再テスト";
    fields["リース物件区分"] = fields["リース物件区分"] || "other";
    fields["契約種別"] = fields["契約種別"] || "lease_contract";
    fields["契約ステータス"] = fields["契約ステータス"] || "active";
    fields["所有権移転区分"] = fields["所有権移転区分"] || "unknown";
    fields["中途解約可否"] = fields["中途解約可否"] || "unknown";
  }

  const payload = {
    paymentDocumentOcrImportId: row.payment_document_ocr_import_id,
    paymentDocumentSortingDraftId: row.latest_sorting_draft_id,
    draft: {
      document_type_code: row.document_type_code || "",
      document_type_label: row.document_type_label || "",
      payment_destination_code: row.payment_destination_code || "contract_insurance_lease",
      payment_destination_label: row.payment_destination_label || "契約・保険・リース",
      accounting_category_code: row.accounting_category_code || "",
      accounting_category_label: row.accounting_category_label || "",
      payable_kind_code: row.payable_kind_code || "",
      payable_kind_label: row.payable_kind_label || "",
      contract_insurance_lease_label: label,
      ai_confidence: row.ai_confidence || "",
      ai_confidence_label: row.ai_confidence_label || "",
      ai_reason: row.ai_reason || "",
      review_reason: row.review_reason || ""
    },
    ai_summary: {
      ...(row.ai_summary_json && typeof row.ai_summary_json === "object" ? row.ai_summary_json : {}),
      contract_insurance_lease: label,
      confidence_label: row.ai_confidence_label || row.ai_confidence || "要確認",
      reason: row.review_reason || row.ai_reason || "GPT2直接API保存再テスト"
    },
    sortResult: row.sort_result_json || {},
    fields,
    visibleFields: fields,
    warnings: ["GPT2直接API保存再テスト"]
  };

  out.push("[対象OCR]");
  out.push("payment_document_ocr_import_id: " + row.payment_document_ocr_import_id);
  out.push("latest_sorting_draft_id: " + (row.latest_sorting_draft_id || ""));
  out.push("file: " + valueText(row.original_file_name || row.saved_file_name));
  out.push("label: " + label);
  out.push("");

  const url = `http://127.0.0.1:${port}/api/payment-documents/contract-insurance-lease-drafts/save`;

  out.push("[POST]");
  out.push(url);
  out.push("");

  let status = "";
  let responseText = "";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    status = String(res.status);
    responseText = await res.text();

    out.push("[APIレスポンス]");
    out.push("status: " + status);
    out.push(responseText);
    out.push("");
  } catch (error) {
    out.push("[API通信エラー]");
    out.push(String(error && error.stack ? error.stack : error));
    out.push("");
  }

  const after = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM accounting.payment_document_contract_insurance_lease_drafts
    WHERE deleted_at IS NULL
  `);

  out.push("[保存後件数]");
  out.push("count: " + after.rows[0].count);
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
      payable_registration_code,
      payable_registration_label,
      accounts_payable_registration_code,
      accounts_payable_registration_label,
      created_at
    FROM accounting.payment_document_contract_insurance_lease_drafts
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC, contract_insurance_lease_draft_id DESC
    LIMIT 5
  `);

  out.push("[最新5件]");
  if (!latest.rows.length) {
    out.push("なし");
  } else {
    for (const item of latest.rows) {
      out.push("----------------------------------------");
      out.push("専門下書きID: " + item.contract_insurance_lease_draft_id);
      out.push("OCR取込ID: " + item.payment_document_ocr_import_id);
      out.push("仕分け下書きID: " + (item.payment_document_sorting_draft_id || ""));
      out.push("draft_no: " + (item.draft_no || ""));
      out.push("is_current: " + item.is_current);
      out.push("draft_status: " + (item.draft_status || ""));
      out.push("契約・保険・リース: " + (item.contract_insurance_lease_kind_code || "") + " / " + (item.contract_insurance_lease_kind_label || ""));
      out.push("保険種類: " + (item.insurance_type_code || "") + " / " + (item.insurance_type_label || ""));
      out.push("リース物件: " + (item.lease_item_name || ""));
      out.push("リース物件区分: " + (item.lease_item_category_code || "") + " / " + (item.lease_item_category_label || ""));
      out.push("契約種別: " + (item.contract_type_code || "") + " / " + (item.contract_type_label || ""));
      out.push("契約ステータス: " + (item.contract_status_code || "") + " / " + (item.contract_status_label || ""));
      out.push("支払状態: " + (item.payment_status_code || "") + " / " + (item.payment_status_label || ""));
      out.push("支払周期: " + (item.payment_cycle_code || "") + " / " + (item.payment_cycle_label || ""));
      out.push("会社負担可否: " + (item.company_burden_code || "") + " / " + (item.company_burden_label || ""));
      out.push("未払登録: " + (item.payable_registration_code || "") + " / " + (item.payable_registration_label || ""));
      out.push("買掛登録: " + (item.accounts_payable_registration_code || "") + " / " + (item.accounts_payable_registration_label || ""));
      out.push("created_at: " + item.created_at);
    }
  }

  out.push("");
  out.push("[判定]");

  if (Number(after.rows[0].count) > Number(before.rows[0].count) && status === "200") {
    out.push("OK: 直接API保存成功。次は画面のまとめて保存で専門下書きまで保存されるか確認。");
  } else {
    out.push("NG: 直接API保存失敗。APIレスポンスのエラー内容を見て次修正。");
  }

  fs.writeFileSync(resultPath, out.join("\r\n"), "utf8");

  await db.end();
}

main().catch(async err => {
  fs.writeFileSync(resultPath, String(err && err.stack ? err.stack : err), "utf8");
  try { await db.end(); } catch {}
  process.exit(1);
});