const path = require("path");
const fs = require("fs");

const projectRoot = process.argv[2];
const resultPath = process.argv[3];
const port = process.argv[4] || "3000";

const webDir = path.join(projectRoot, "web_receiver");
process.chdir(webDir);

const db = require(path.join(webDir, "src", "db"));

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

async function main() {
  const out = [];

  out.push("==============================");
  out.push("GPT2 契約・保険・リース専門下書き 直接API保存テスト");
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
    text(row.contract_insurance_lease_label) ||
    (text(row.document_type_code).includes("lease") ? "リース" : "") ||
    (text(row.document_type_code).includes("insurance") ? "保険" : "") ||
    "要確認";

  const fields = Object.assign(
    {},
    row.visible_fields_json && typeof row.visible_fields_json === "object" ? row.visible_fields_json : {},
    {
      "契約・保険・リース": label,
      "書類名": text(row.original_file_name || row.saved_file_name),
      "支払状態": "unpaid",
      "会社負担可否": "company",
      "個人負担混在": "none",
      "未払登録": "register",
      "買掛登録": "not_register",
      "支払周期": "monthly",
      "要確認メモ": "GPT2直接API保存テスト"
    }
  );

  if (label.includes("リース")) {
    fields["リース物件"] = fields["リース物件"] || "直接API保存テスト";
    fields["リース物件区分"] = fields["リース物件区分"] || "other";
    fields["契約種別"] = fields["契約種別"] || "lease_contract";
    fields["契約ステータス"] = fields["契約ステータス"] || "active";
    fields["所有権移転区分"] = fields["所有権移転区分"] || "unknown";
    fields["中途解約可否"] = fields["中途解約可否"] || "unknown";
  }

  if (label.includes("保険")) {
    fields["保険種類"] = fields["保険種類"] || "other";
    fields["契約種別"] = fields["契約種別"] || "insurance_contract";
    fields["契約ステータス"] = fields["契約ステータス"] || "active";
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
    ai_summary: Object.assign(
      {},
      row.ai_summary_json && typeof row.ai_summary_json === "object" ? row.ai_summary_json : {},
      {
        contract_insurance_lease: label,
        confidence_label: row.ai_confidence_label || row.ai_confidence || "要確認",
        reason: row.review_reason || row.ai_reason || "GPT2直接API保存テスト"
      }
    ),
    sortResult: row.sort_result_json || {},
    fields,
    visibleFields: fields,
    warnings: ["GPT2直接API保存テスト"]
  };

  out.push("[対象OCR]");
  out.push("payment_document_ocr_import_id: " + row.payment_document_ocr_import_id);
  out.push("latest_sorting_draft_id: " + (row.latest_sorting_draft_id || ""));
  out.push("file: " + text(row.original_file_name || row.saved_file_name));
  out.push("label: " + label);
  out.push("");

  const url = `http://127.0.0.1:${port}/api/payment-documents/contract-insurance-lease-drafts/save`;

  out.push("[POST]");
  out.push(url);
  out.push("");

  let responseText = "";
  let status = "";
  let json = null;

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

    try {
      json = JSON.parse(responseText);
    } catch {
      json = null;
    }

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
      out.push(JSON.stringify(item));
    }
  }

  if (Number(after.rows[0].count) > Number(before.rows[0].count)) {
    out.push("");
    out.push("[判定]");
    out.push("OK: 直接APIでは専門下書き保存できました。画面側のまとめて保存呼び出しを次に直します。");
  } else {
    out.push("");
    out.push("[判定]");
    out.push("NG: 直接APIでも保存件数が増えていません。API/routes側を次に直します。");
  }

  fs.writeFileSync(resultPath, out.join("\r\n"), "utf8");

  await db.end();
}

main().catch(async err => {
  fs.writeFileSync(resultPath, String(err && err.stack ? err.stack : err), "utf8");
  try { await db.end(); } catch {}
  process.exit(1);
});