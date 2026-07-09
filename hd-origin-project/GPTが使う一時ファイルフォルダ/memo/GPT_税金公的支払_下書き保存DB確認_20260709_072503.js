const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const outPath = process.argv[2];

const db = require(path.join(projectRoot, "web_receiver", "src", "db"));

function pretty(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

(async () => {
  const lines = [];

  lines.push("==============================");
  lines.push("GPT 税金・公的支払 下書き保存DB確認");
  lines.push("==============================");
  lines.push("日時: " + new Date().toLocaleString("ja-JP"));
  lines.push("");

  const sql = `
    SELECT
      payment_document_sorting_draft_id,
      payment_document_ocr_import_id,
      original_file_name,
      document_type_label,
      payment_destination_label,
      accounting_category_label,
      payable_kind_code,
      payable_kind_label,
      specialist_route_code,
      specialist_route_label,
      analysis_system_code,
      analysis_system_label,
      analysis_system_confidence,
      visible_fields_json,
      warnings_json,
      sort_result_json,
      created_by_page,
      updated_at,
      created_at
    FROM accounting.payment_document_sorting_drafts
    WHERE
      deleted_at IS NULL
      AND (
        specialist_route_code = 'tax_public'
        OR analysis_system_code = 'tax_public_analysis'
        OR payment_destination_code = 'tax_public'
      )
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 10
  `;

  const result = await db.query(sql);

  lines.push("[件数]");
  lines.push(String(result.rows.length));
  lines.push("");

  if (!result.rows.length) {
    lines.push("税金・公的支払系の下書き保存データは見つかりませんでした。");
    lines.push("画面で「まとめて保存」または単体保存を押した後、もう一度確認してください。");
  }

  result.rows.forEach((row, index) => {
    lines.push("-----------------------------------");
    lines.push((index + 1) + "件目");
    lines.push("-----------------------------------");
    lines.push("sorting_draft_id: " + pretty(row.payment_document_sorting_draft_id));
    lines.push("ocr_import_id    : " + pretty(row.payment_document_ocr_import_id));
    lines.push("file             : " + pretty(row.original_file_name));
    lines.push("document_type    : " + pretty(row.document_type_label));
    lines.push("destination      : " + pretty(row.payment_destination_label));
    lines.push("accounting       : " + pretty(row.accounting_category_label));
    lines.push("payable_kind_code: " + pretty(row.payable_kind_code));
    lines.push("payable_kind_label: " + pretty(row.payable_kind_label));
    lines.push("specialist_route : " + pretty(row.specialist_route_code) + " / " + pretty(row.specialist_route_label));
    lines.push("analysis_system  : " + pretty(row.analysis_system_code) + " / " + pretty(row.analysis_system_label));
    lines.push("confidence       : " + pretty(row.analysis_system_confidence));
    lines.push("created_by_page  : " + pretty(row.created_by_page));
    lines.push("updated_at       : " + pretty(row.updated_at));
    lines.push("");
    lines.push("[visible_fields_json]");
    lines.push(pretty(row.visible_fields_json));
    lines.push("");
    lines.push("[warnings_json]");
    lines.push(pretty(row.warnings_json));
    lines.push("");
    lines.push("[sort_result_json]");
    lines.push(pretty(row.sort_result_json));
    lines.push("");
  });

  fs.writeFileSync(outPath, lines.join("\r\n"), "utf8");
  await db.end?.();
})().catch(async err => {
  fs.writeFileSync(outPath, "ERROR:\r\n" + (err && err.stack ? err.stack : String(err)), "utf8");
  try { await db.end?.(); } catch {}
  process.exit(1);
});
