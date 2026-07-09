const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const outPath = process.argv[2];

const db = require(path.join(projectRoot, "web_receiver", "src", "db"));

function q(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function pretty(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

(async () => {
  const lines = [];

  lines.push("==============================");
  lines.push("GPT 税金・公的支払 下書き保存DB確認 列自動版");
  lines.push("==============================");
  lines.push("日時: " + new Date().toLocaleString("ja-JP"));
  lines.push("");

  const colResult = await db.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'payment_document_sorting_drafts'
    ORDER BY ordinal_position
  `);

  const columns = colResult.rows.map(r => r.column_name);
  const colSet = new Set(columns);

  lines.push("[payment_document_sorting_drafts 列一覧]");
  colResult.rows.forEach(r => {
    lines.push("- " + r.column_name + " : " + r.data_type);
  });
  lines.push("");

  if (!columns.length) {
    lines.push("payment_document_sorting_drafts テーブルが見つかりません。");
    fs.writeFileSync(outPath, lines.join("\r\n"), "utf8");
    await db.end?.();
    return;
  }

  const wanted = [
    "payment_document_sorting_draft_id",
    "payment_document_ocr_import_id",
    "original_file_name",
    "saved_file_name",
    "document_type_code",
    "document_type_label",
    "payment_destination_code",
    "payment_destination_label",
    "accounting_category_code",
    "accounting_category_label",
    "payable_kind_code",
    "payable_kind_label",
    "specialist_route_code",
    "specialist_route_label",
    "analysis_system_code",
    "analysis_system_label",
    "analysis_system_confidence",
    "visible_fields_json",
    "warnings_json",
    "sort_result_json",
    "ai_result_json",
    "ai_response_json",
    "draft_json",
    "created_by_page",
    "created_at",
    "updated_at"
  ];

  const selectCols = wanted.filter(c => colSet.has(c));

  if (!selectCols.length) {
    lines.push("確認対象にできる列が見つかりません。");
    fs.writeFileSync(outPath, lines.join("\r\n"), "utf8");
    await db.end?.();
    return;
  }

  const jsonLikeCols = columns.filter(c => {
    const lower = c.toLowerCase();
    return lower.includes("json") || lower.includes("result") || lower.includes("draft");
  });

  const whereParts = [];

  if (colSet.has("deleted_at")) {
    whereParts.push(`deleted_at IS NULL`);
  }

  const taxParts = [];

  for (const c of ["specialist_route_code", "payment_destination_code", "analysis_system_code", "document_group"]) {
    if (colSet.has(c)) {
      taxParts.push(`${q(c)} ILIKE '%tax_public%'`);
      taxParts.push(`${q(c)} ILIKE '%taxpublic%'`);
    }
  }

  for (const c of ["specialist_route_label", "payment_destination_label", "analysis_system_label", "document_type_label"]) {
    if (colSet.has(c)) {
      taxParts.push(`${q(c)} ILIKE '%税金%'`);
      taxParts.push(`${q(c)} ILIKE '%公的%'`);
    }
  }

  for (const c of jsonLikeCols) {
    taxParts.push(`${q(c)}::text ILIKE '%tax_public%'`);
    taxParts.push(`${q(c)}::text ILIKE '%taxpublic%'`);
    taxParts.push(`${q(c)}::text ILIKE '%税金%'`);
    taxParts.push(`${q(c)}::text ILIKE '%公的%'`);
  }

  if (taxParts.length) {
    whereParts.push("(" + taxParts.join(" OR ") + ")");
  }

  const orderParts = [];
  if (colSet.has("updated_at")) orderParts.push("updated_at DESC NULLS LAST");
  if (colSet.has("created_at")) orderParts.push("created_at DESC NULLS LAST");
  if (colSet.has("payment_document_sorting_draft_id")) orderParts.push("payment_document_sorting_draft_id DESC");

  const sql = `
    SELECT ${selectCols.map(q).join(", ")}
    FROM accounting.payment_document_sorting_drafts
    ${whereParts.length ? "WHERE " + whereParts.join(" AND ") : ""}
    ${orderParts.length ? "ORDER BY " + orderParts.join(", ") : ""}
    LIMIT 10
  `;

  lines.push("[実行SQL]");
  lines.push(sql);
  lines.push("");

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

    for (const c of selectCols) {
      lines.push("[" + c + "]");
      lines.push(pretty(row[c]));
      lines.push("");
    }
  });

  fs.writeFileSync(outPath, lines.join("\r\n"), "utf8");
  await db.end?.();
})().catch(async err => {
  fs.writeFileSync(outPath, "ERROR:\r\n" + (err && err.stack ? err.stack : String(err)), "utf8");
  try { await db.end?.(); } catch {}
  process.exit(1);
});
