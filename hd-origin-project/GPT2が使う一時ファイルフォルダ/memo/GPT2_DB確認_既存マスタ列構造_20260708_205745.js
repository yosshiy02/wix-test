const fs = require("fs");
const path = require("path");

const projectRoot = process.argv[2];
const resultPath = process.argv[3];

const webDir = path.join(projectRoot, "web_receiver");
process.chdir(webDir);

const db = require(path.join(webDir, "src", "db"));

function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function line(out, value = "") {
  out.push(String(value));
}

function rowsToText(rows) {
  if (!rows || rows.length === 0) return ["なし"];

  return rows.map(row => {
    return Object.entries(row)
      .map(([k, v]) => `${k}=${v === null ? "[NULL]" : v}`)
      .join(" / ");
  });
}

async function safeQuery(sql, params = []) {
  try {
    return await db.query(sql, params);
  } catch (err) {
    return { rows: [{ error: err.message || String(err) }] };
  }
}

function pick(columns, candidates) {
  return candidates.find(c => columns.includes(c)) || "";
}

async function main() {
  const out = [];

  const masterTables = [
    "document_types",
    "evidence_types",
    "payment_destinations",
    "accounting_categories",
    "payable_kinds",
    "vendors",
    "account_titles",
    "tax_categories",
    "invoice_types",
    "payment_methods",
    "target_people",
    "purposes",
    "projects",
    "departments",
    "tax_treatments",
    "payment_source_types"
  ];

  line(out, "==============================");
  line(out, "GPT2 DB確認 既存マスタ列構造");
  line(out, "==============================");
  line(out, "日時: " + new Date().toISOString());
  line(out, "");
  line(out, "[確認方針]");
  line(out, "- 読み取り専用");
  line(out, "- DB変更なし");
  line(out, "- 既存 expenses マスタの列名・主キー・ユニーク制約を確認");
  line(out, "- 足りない契約・保険・リース系マスタを同じ形式で作るための確認");
  line(out, "");

  const currentDb = await safeQuery(`
    SELECT
      current_database() AS database_name,
      current_schema() AS current_schema
  `);

  line(out, "[接続先]");
  rowsToText(currentDb.rows).forEach(x => line(out, x));
  line(out, "");

  for (const tableName of masterTables) {
    line(out, "");
    line(out, "========================================");
    line(out, `expenses.${tableName}`);
    line(out, "========================================");

    const exists = await safeQuery(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = 'expenses'
        AND table_name = $1
    `, [tableName]);

    if (!exists.rows || exists.rows.length === 0) {
      line(out, "テーブルなし");
      continue;
    }

    const cols = await safeQuery(`
      SELECT
        ordinal_position,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'expenses'
        AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    line(out, "[列一覧]");
    rowsToText(cols.rows).forEach(x => line(out, x));
    line(out, "");

    const constraints = await safeQuery(`
      SELECT
        tc.constraint_type,
        tc.constraint_name,
        kcu.column_name,
        kcu.ordinal_position
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_schema = kcu.constraint_schema
       AND tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      WHERE tc.table_schema = 'expenses'
        AND tc.table_name = $1
      ORDER BY
        tc.constraint_type,
        tc.constraint_name,
        kcu.ordinal_position
    `, [tableName]);

    line(out, "[制約]");
    rowsToText(constraints.rows).forEach(x => line(out, x));
    line(out, "");

    const indexes = await safeQuery(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'expenses'
        AND tablename = $1
      ORDER BY indexname
    `, [tableName]);

    line(out, "[インデックス]");
    rowsToText(indexes.rows).forEach(x => line(out, x));
    line(out, "");

    const count = await safeQuery(`
      SELECT COUNT(*)::text AS count
      FROM expenses.${quoteIdent(tableName)}
    `);

    line(out, "[件数]");
    rowsToText(count.rows).forEach(x => line(out, x));
    line(out, "");

    const colNames = (cols.rows || []).map(r => r.column_name);

    const idCol = pick(colNames, [
      `${tableName.slice(0, -1)}_id`,
      `${tableName}_id`,
      "id"
    ]);

    const codeCol = pick(colNames, [
      "program_code",
      "internal_code",
      "code",
      `${tableName.slice(0, -1)}_code`,
      "account_title_code",
      "document_type_code",
      "evidence_type_code",
      "payment_destination_code",
      "accounting_category_code",
      "payable_kind_code",
      "tax_category_code",
      "invoice_type_code",
      "payment_method_code",
      "payment_source_type_code",
      "vendor_code",
      "target_person_code",
      "purpose_code",
      "project_code",
      "department_code",
      "tax_treatment_code"
    ]);

    const labelCol = pick(colNames, [
      "display_name",
      "     label",
      "name",
      `${tableName.slice(0, -1)}_label`,
      "account_title_name",
      "document_type_label",
      "evidence_type_label",
      "payment_destination_label",
      "accounting_category_label",
      "payable_kind_label",
      "tax_category_label",
      "invoice_type_label",
      "payment_method_label",
      "payment_source_type_label",
      "vendor_name",
      "target_person_name",
      "purpose_name",
      "project_name",
      "department_name",
      "tax_treatment_label"
    ]);

    const sortCol = pick(colNames, ["sort_order", "display_order"]);
    const activeCol = pick(colNames, ["is_active", "active"]);

    line(out, "[推定パターン]");
    line(out, `id_col=${idCol || "[不明]"}`);
    line(out, `code_col=${codeCol || "[不明]"}`);
    line(out, `label_col=${labelCol || "[不明]"}`);
    line(out, `sort_col=${sortCol || "[不明]"}`);
    line(out, `active_col=${activeCol || "[不明]"}`);
    line(out, "");

    const sampleCols = [
      idCol,
      codeCol,
      labelCol,
      sortCol,
      activeCol,
      "created_at",
      "updated_at"
    ].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);

    if (sampleCols.length > 0) {
      const sampleSql = `
        SELECT ${sampleCols.map(quoteIdent).join(", ")}
        FROM expenses.${quoteIdent(tableName)}
        ORDER BY ${sortCol ? quoteIdent(sortCol) : sampleCols.map(quoteIdent)[0]}
        LIMIT 30
      `;

      const sample = await safeQuery(sampleSql);

      line(out, "[サンプル]");
      line(out, "columns: " + sampleCols.join(", "));
      rowsToText(sample.rows).forEach(x => line(out, x));
      line(out, "");
    }
  }

  line(out, "");
  line(out, "========================================");
  line(out, "追加予定マスタ");
  line(out, "========================================");

  const missingMasters = [
    "contract_insurance_lease_kinds",
    "insurance_types",
    "lease_item_categories",
    "contract_types",
    "contract_statuses",
    "payment_statuses",
    "payment_cycles",
    "company_burden_types",
    "personal_mix_flags",
    "payable_registration_types",
    "accounts_payable_registration_types",
    "auto_renewal_types",
    "ownership_transfer_types",
    "early_cancellation_types"
  ];

  for (const name of missingMasters) {
    line(out, "- expenses." + name);
  }

  line(out, "");
  line(out, "[確認後の判断]");
  line(out, "- 既存マスタの列命名に合わせて、足りない14マスタを追加する");
  line(out, "- 既存が program_code/display_name 型ならそれに合わせる");
  line(out, "- 既存が *_code/*_label 型ならそれに合わせる");
  line(out, "- マスタ追加は次段階。今回は確認のみ。");

  fs.writeFileSync(resultPath, out.join("\r\n"), "utf8");

  await db.end();
}

main().catch(async err => {
  const out = [];
  out.push("==============================");
  out.push("GPT2 DB確認 既存マスタ列構造 エラー");
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