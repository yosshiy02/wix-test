const fs = require("fs");
const path = require("path");

const projectRoot = process.argv[2];
const webDir = path.join(projectRoot, "web_receiver");
const resultPath = process.argv[3];

process.chdir(webDir);

const db = require(path.join(webDir, "src", "db"));

function line(out, text = "") {
  out.push(String(text));
}

function rowsToText(rows) {
  if (!rows || rows.length === 0) return ["なし"];

  return rows.map(row => {
    return Object.entries(row)
      .map(([k, v]) => `${k}=${v === null ? "[NULL]" : v}`)
      .join(" / ");
  });
}

async function main() {
  const out = [];

  line(out, "==============================");
  line(out, "GPT2 DB確認 契約・保険・リース項目");
  line(out, "==============================");
  line(out, "日時: " + new Date().toISOString());
  line(out, "");
  line(out, "[確認方針]");
  line(out, "- 読み取り専用");
  line(out, "- DB変更なし");
  line(out, "- 契約・保険・リース用の専用列/JSON/マスタ候補を見る");
  line(out, "");

  const currentDb = await db.query(`
    SELECT
      current_database() AS database_name,
      current_schema() AS current_schema
  `);

  line(out, "[接続先]");
  rowsToText(currentDb.rows).forEach(x => line(out, x));
  line(out, "");

  const tables = await db.query(`
    SELECT
      table_schema,
      table_name
    FROM information_schema.tables
    WHERE table_schema = 'accounting'
      AND (
        table_name ILIKE '%payment_document%'
        OR table_name ILIKE '%payable%'
        OR table_name ILIKE '%master%'
        OR table_name ILIKE '%insurance%'
        OR table_name ILIKE '%lease%'
        OR table_name ILIKE '%contract%'
      )
    ORDER BY table_schema, table_name
  `);

  line(out, "[関連しそうなテーブル]");
  rowsToText(tables.rows).forEach(x => line(out, x));
  line(out, "");

  const targetColumns = await db.query(`
    SELECT
      table_name,
      ordinal_position,
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name IN (
        'payment_document_ocr_imports',
        'payment_document_sorting_drafts',
        'payables',
        'payable_details'
      )
    ORDER BY table_name, ordinal_position
  `);

  line(out, "[主要テーブルの列一覧]");
  rowsToText(targetColumns.rows).forEach(x => line(out, x));
  line(out, "");

  const contractColumns = await db.query(`
    SELECT
      table_name,
      ordinal_position,
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND (
        column_name ILIKE '%contract%'
        OR column_name ILIKE '%insurance%'
        OR column_name ILIKE '%lease%'
        OR column_name ILIKE '%analysis_system%'
        OR column_name ILIKE '%visible%'
        OR column_name ILIKE '%field%'
        OR column_name ILIKE '%summary%'
        OR column_name ILIKE '%confidence%'
        OR column_name ILIKE '%reason%'
        OR column_name ILIKE '%group%'
      )
    ORDER BY table_name, ordinal_position
  `);

  line(out, "[契約・保険・リース/AI表示に関係しそうな列]");
  rowsToText(contractColumns.rows).forEach(x => line(out, x));
  line(out, "");

  const jsonColumns = await db.query(`
    SELECT
      table_name,
      ordinal_position,
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND data_type IN ('json', 'jsonb')
    ORDER BY table_name, ordinal_position
  `);

  line(out, "[JSON/JSONB列]");
  rowsToText(jsonColumns.rows).forEach(x => line(out, x));
  line(out, "");

  const recentDrafts = await db.query(`
    SELECT
      payment_document_sorting_draft_id,
      payment_document_ocr_import_id,
      document_type_code,
      payment_destination_code,
      accounting_category_code,
      payable_kind_code,
      analysis_system_code,
      analysis_system_label,
      analysis_system_confidence,
      contract_insurance_lease_label,
      public_utility_label,
      ai_confidence,
      created_at,
      updated_at
    FROM accounting.payment_document_sorting_drafts
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 10
  `).catch(err => ({ rows: [{ error: err.message }] }));

  line(out, "[直近の仕分け下書き 10件]");
  rowsToText(recentDrafts.rows).forEach(x => line(out, x));
  line(out, "");

  line(out, "[見るべきポイント]");
  line(out, "1. contract_insurance_lease 専用の別テーブルがあるか");
  line(out, "2. payment_document_sorting_drafts に契約・保険・リース用の列があるか");
  line(out, "3. fields / ai_summary / visible_field_labels などが JSON 保存か");
  line(out, "4. analysis_system 系の列があるか");
  line(out, "5. 保険種類、リース物件、契約開始日などが個別列かJSON内か");

  fs.writeFileSync(resultPath, out.join("\r\n"), "utf8");

  await db.end();
}

main().catch(async err => {
  const out = [];
  out.push("==============================");
  out.push("GPT2 DB確認 エラー");
  out.push("==============================");
  out.push("日時: " + new Date().toISOString());
  out.push("");
  out.push(String(err && err.stack ? err.stack : err));
  fs.writeFileSync(resultPath, out.join("\r\n"), "utf8");

  try {
    await db.end();
  } catch {}

  process.exit(1);
});
