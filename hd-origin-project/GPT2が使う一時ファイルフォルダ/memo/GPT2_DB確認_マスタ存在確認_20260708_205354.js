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

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value);
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

function hasAny(value, words) {
  const s = String(value || "").toLowerCase();
  return words.some(w => s.includes(String(w).toLowerCase()));
}

async function safeQuery(sql, params = []) {
  try {
    return await db.query(sql, params);
  } catch (err) {
    return { rows: [{ error: err.message || String(err) }] };
  }
}

async function main() {
  const out = [];

  line(out, "==============================");
  line(out, "GPT2 DB確認 マスタ存在確認");
  line(out, "==============================");
  line(out, "日時: " + new Date().toISOString());
  line(out, "");
  line(out, "[確認方針]");
  line(out, "- 読み取り専用");
  line(out, "- DB変更なし");
  line(out, "- 契約・保険・リース設計で必要なマスタが既存にあるか確認");
  line(out, "");

  const currentDb = await safeQuery(`
    SELECT
      current_database() AS database_name,
      current_schema() AS current_schema
  `);

  line(out, "[接続先]");
  rowsToText(currentDb.rows).forEach(x => line(out, x));
  line(out, "");

  const desiredMasters = [
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

  const tables = await safeQuery(`
    SELECT
      table_schema,
      table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name
  `);

  line(out, "[全テーブル]");
  rowsToText(tables.rows).forEach(x => line(out, x));
  line(out, "");

  const columns = await safeQuery(`
    SELECT
      table_schema,
      table_name,
      ordinal_position,
      column_name,
      data_type
    FROM information_schema.columns
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name, ordinal_position
  `);

  const tableColumnMap = new Map();

  for (const row of columns.rows || []) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!tableColumnMap.has(key)) tableColumnMap.set(key, []);
    tableColumnMap.get(key).push(row);
  }

  const tableRows = tables.rows || [];

  const candidateWords = [
    "master",
    "document_type",
    "evidence_type",
    "payment_destination",
    "accounting_category",
    "payable_kind",
    "vendor",
    "account_title",
    "tax_category",
    "invoice_type",
    "payment_method",
    "target_people",
    "target_person",
    "purpose",
    "project",
    "department",
    "contract",
    "insurance",
    "lease",
    "status",
    "cycle",
    "burden",
    "renewal",
    "ownership",
    "cancellation"
  ];

  const candidateTables = [];

  for (const t of tableRows) {
    const key = `${t.table_schema}.${t.table_name}`;
    const cols = tableColumnMap.get(key) || [];

    const tableLooksMaster = hasAny(t.table_name, candidateWords);
    const columnsLookMaster = cols.some(c => hasAny(c.column_name, [
      "master_type",
      "program_code",
      "internal_code",
      "code",
      "label",
      "display_name",
      "sort_order",
      "is_active"
    ]));

    if (tableLooksMaster || columnsLookMaster) {
      candidateTables.push({
        table_schema: t.table_schema,
        table_name: t.table_name,
        reason: [
          tableLooksMaster ? "table_name" : "",
          columnsLookMaster ? "columns" : ""
        ].filter(Boolean).join("+")
      });
    }
  }

  line(out, "[マスタ候補テーブル]");
  rowsToText(candidateTables).forEach(x => line(out, x));
  line(out, "");

  line(out, "[設計上ほしいマスタ名]");
  desiredMasters.forEach(name => line(out, "- " + name));
  line(out, "");

  line(out, "[テーブル名として存在するか]");
  for (const name of desiredMasters) {
    const exact = tableRows.filter(t => t.table_name === name);
    const partial = tableRows.filter(t => t.table_name.includes(name) || name.includes(t.table_name));

    if (exact.length > 0) {
      line(out, `${name}: あり exact -> ${exact.map(t => `${t.table_schema}.${t.table_name}`).join(", ")}`);
    } else if (partial.length > 0) {
      line(out, `${name}: 近い候補 -> ${partial.map(t => `${t.table_schema}.${t.table_name}`).join(", ")}`);
    } else {
      line(out, `${name}: テーブル名では見当たらない`);
    }
  }
  line(out, "");

  const genericMasterCandidates = candidateTables.filter(t => {
    const cols = tableColumnMap.get(`${t.table_schema}.${t.table_name}`) || [];
    return cols.some(c => c.column_name === "master_type" || c.column_name === "master_code" || c.column_name === "type_code");
  });

  line(out, "[汎用マスタらしいテーブル]");
  rowsToText(genericMasterCandidates).forEach(x => line(out, x));
  line(out, "");

  for (const t of genericMasterCandidates) {
    const cols = tableColumnMap.get(`${t.table_schema}.${t.table_name}`) || [];
    const colNames = cols.map(c => c.column_name);

    const typeCol =
      colNames.includes("master_type") ? "master_type" :
      colNames.includes("master_code") ? "master_code" :
      colNames.includes("type_code") ? "type_code" :
      "";

    if (!typeCol) continue;

    const sql = `
      SELECT ${quoteIdent(typeCol)} AS master_type, COUNT(*) AS count
      FROM ${quoteIdent(t.table_schema)}.${quoteIdent(t.table_name)}
      GROUP BY ${quoteIdent(typeCol)}
      ORDER BY ${quoteIdent(typeCol)}
      LIMIT 100
    `;

    const res = await safeQuery(sql);

    line(out, `[${t.table_schema}.${t.table_name}] master_type別件数`);
    rowsToText(res.rows).forEach(x => line(out, x));
    line(out, "");
  }

  line(out, "[マスタ候補テーブル サンプル]");
  for (const t of candidateTables) {
    const cols = tableColumnMap.get(`${t.table_schema}.${t.table_name}`) || [];
    const wanted = cols
      .map(c => c.column_name)
      .filter(c => [
        "master_type",
        "type",
        "type_code",
        "master_code",
        "program_code",
        "internal_code",
        "code",
        "name",
        "label",
        "display_name",
        "description",
        "sort_order",
        "is_active",
        "deleted_at",
        "created_at",
        "updated_at"
      ].includes(c));

    const selectCols = wanted.length > 0
      ? wanted.slice(0, 12)
      : cols.map(c => c.column_name).slice(0, 8);

    if (selectCols.length === 0) continue;

    const sql = `
      SELECT ${selectCols.map(quoteIdent).join(", ")}
      FROM ${quoteIdent(t.table_schema)}.${quoteIdent(t.table_name)}
      LIMIT 20
    `;

    const sample = await safeQuery(sql);

    line(out, "");
    line(out, `--- ${t.table_schema}.${t.table_name} ---`);
    line(out, "columns: " + selectCols.join(", "));
    rowsToText(sample.rows).forEach(x => line(out, x));
  }

  line(out, "");
  line(out, "[判定メモ]");
  line(out, "- 既存マスタにあるものはそれを使う");
  line(out, "- 見当たらないものだけ追加マスタ候補にする");
  line(out, "- 汎用マスタ方式なら master_type 別件数を見る");
  line(out, "- 個別テーブル方式なら該当テーブルの有無を見る");

  fs.writeFileSync(resultPath, out.join("\r\n"), "utf8");

  await db.end();
}

main().catch(async err => {
  const out = [];
  out.push("==============================");
  out.push("GPT2 DB確認 マスタ存在確認 エラー");
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
