const fs = require("fs");
const path = require("path");

const projectRoot = process.argv[2];
const migrationDst = process.argv[3];
const migrationAfter = process.argv[4];
const checkResultPath = process.argv[5];

const webDir = path.join(projectRoot, "web_receiver");
process.chdir(webDir);

const db = require(path.join(webDir, "src", "db"));

function q(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function lit(value) {
  if (value === null || value === undefined) return "NULL";
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function lineColFromPosition(text, pos1) {
  const pos = Math.max(0, Number(pos1 || 1) - 1);
  const before = text.slice(0, pos);
  const lines = before.split(/\r?\n/);
  return {
    line: lines.length,
    col: lines[lines.length - 1].length + 1
  };
}

function numberedContext(text, centerLine, span) {
  const lines = text.split(/\r?\n/);
  const start = Math.max(1, centerLine - span);
  const end = Math.min(lines.length, centerLine + span);
  const out = [];

  for (let i = start; i <= end; i++) {
    const marker = i === centerLine ? ">>" : "  ";
    out.push(`${marker} ${String(i).padStart(5, " ")} | ${lines[i - 1]}`);
  }

  return out;
}

const masters = [
  {
    table: "contract_insurance_lease_kinds",
    id: "contract_insurance_lease_kind_id",
    code: "contract_insurance_lease_kind_code",
    name: "contract_insurance_lease_kind_name",
    rows: [
      ["contract", "契約", 10],
      ["insurance", "保険", 20],
      ["lease", "リース", 30],
      ["mixed", "混在", 90],
      ["other", "その他", 900],
      ["needs_review", "要確認", 999]
    ]
  },
  {
    table: "insurance_types",
    id: "insurance_type_id",
    code: "insurance_type_code",
    name: "insurance_type_name",
    rows: [
      ["fire", "火災保険", 10],
      ["vehicle", "自動車保険", 20],
      ["liability", "賠償責任保険", 30],
      ["product_liability", "PL保険", 40],
      ["workers_accident_extra", "労災上乗せ保険", 50],
      ["life", "生命保険", 60],
      ["medical", "医療保険", 70],
      ["cyber", "サイバー保険", 80],
      ["property", "財産保険", 90],
      ["other", "その他", 900],
      ["needs_review", "要確認", 999]
    ]
  },
  {
    table: "lease_item_categories",
    id: "lease_item_category_id",
    code: "lease_item_category_code",
    name: "lease_item_category_name",
    rows: [
      ["vehicle", "車両", 10],
      ["machine", "機械設備", 20],
      ["it_device", "IT機器", 30],
      ["office_equipment", "事務機器", 40],
      ["fixture", "什器備品", 50],
      ["store_equipment", "店舗設備", 60],
      ["other", "その他", 900],
      ["needs_review", "要確認", 999]
    ]
  },
  {
    table: "contract_types",
    id: "contract_type_id",
    code: "contract_type_code",
    name: "contract_type_name",
    rows: [
      ["maintenance", "保守契約", 10],
      ["rent", "賃貸借契約", 20],
      ["service", "サービス契約", 30],
      ["subscription", "サブスク契約", 40],
      ["outsourcing", "業務委託契約", 50],
      ["license", "ライセンス契約", 60],
      ["insurance_contract", "保険契約", 70],
      ["lease_contract", "リース契約", 80],
      ["other", "その他", 900],
      ["needs_review", "要確認", 999]
    ]
  },
  {
    table: "contract_statuses",
    id: "contract_status_id",
    code: "contract_status_code",
    name: "contract_status_name",
    rows: [
      ["active", "有効", 10],
      ["pending", "確認中", 20],
      ["renewal_pending", "更新確認中", 30],
      ["ended", "終了", 40],
      ["cancelled", "解約済み", 50],
      ["needs_review", "要確認", 999]
    ]
  },
  {
    table: "payment_statuses",
    id: "payment_status_id",
    code: "payment_status_code",
    name: "payment_status_name",
    rows: [
      ["unpaid", "未払", 10],
      ["scheduled", "支払予定", 20],
      ["paid", "支払済み", 30],
      ["partially_paid", "一部支払済み", 40],
      ["not_applicable", "対象外", 900],
      ["needs_review", "要確認", 999]
    ]
  },
  {
    table: "payment_cycles",
    id: "payment_cycle_id",
    code: "payment_cycle_code",
    name: "payment_cycle_name",
    rows: [
      ["once", "一回", 10],
      ["monthly", "毎月", 20],
      ["every_two_months", "2か月ごと", 30],
      ["quarterly", "四半期", 40],
      ["half_year", "半年", 50],
      ["yearly", "年1回", 60],
      ["other", "その他", 900],
      ["needs_review", "要確認", 999]
    ]
  },
  {
    table: "company_burden_types",
    id: "company_burden_type_id",
    code: "company_burden_type_code",
    name: "company_burden_type_name",
    rows: [
      ["company", "会社負担", 10],
      ["personal", "個人負担", 20],
      ["mixed", "混在", 30],
      ["not_applicable", "対象外", 900],
      ["needs_review", "要確認", 999]
    ]
  },
  {
    table: "personal_mix_flags",
    id: "personal_mix_flag_id",
    code: "personal_mix_flag_code",
    name: "personal_mix_flag_name",
    rows: [
      ["none", "なし", 10],
      ["exists", "あり", 20],
      ["unknown", "不明", 900],
      ["needs_review", "要確認", 999]
    ]
  },
  {
    table: "payable_registration_types",
    id: "payable_registration_type_id",
    code: "payable_registration_type_code",
    name: "payable_registration_type_name",
    rows: [
      ["register", "登録する", 10],
      ["not_register", "登録しない", 20],
      ["needs_review", "要確認", 999]
    ]
  },
  {
    table: "accounts_payable_registration_types",
    id: "accounts_payable_registration_type_id",
    code: "accounts_payable_registration_type_code",
    name: "accounts_payable_registration_type_name",
    rows: [
      ["register", "登録する", 10],
      ["not_register", "登録しない", 20],
      ["needs_review", "要確認", 999]
    ]
  },
  {
    table: "auto_renewal_types",
    id: "auto_renewal_type_id",
    code: "auto_renewal_type_code",
    name: "auto_renewal_type_name",
    rows: [
      ["yes", "あり", 10],
      ["no", "なし", 20],
      ["unknown", "不明", 900],
      ["needs_review", "要確認", 999]
    ]
  },
  {
    table: "ownership_transfer_types",
    id: "ownership_transfer_type_id",
    code: "ownership_transfer_type_code",
    name: "ownership_transfer_type_name",
    rows: [
      ["transfer", "所有権移転", 10],
      ["non_transfer", "所有権移転外", 20],
      ["unknown", "不明", 900],
      ["needs_review", "要確認", 999]
    ]
  },
  {
    table: "early_cancellation_types",
    id: "early_cancellation_type_id",
    code: "early_cancellation_type_code",
    name: "early_cancellation_type_name",
    rows: [
      ["allowed", "可能", 10],
      ["not_allowed", "不可", 20],
      ["unknown", "不明", 900],
      ["needs_review", "要確認", 999]
    ]
  }
];

function createSql() {
  const sql = [];

  sql.push("BEGIN;");
  sql.push("");

  for (const m of masters) {
    sql.push(`CREATE TABLE IF NOT EXISTS expenses.${q(m.table)} (`);
    sql.push(`  ${q(m.id)} BIGSERIAL PRIMARY KEY,`);
    sql.push(`  ${q(m.code)} VARCHAR(100),`);
    sql.push(`  ${q(m.name)} TEXT NOT NULL,`);
    sql.push(`  sort_order INTEGER NOT NULL DEFAULT 0,`);
    sql.push(`  is_active BOOLEAN NOT NULL DEFAULT TRUE,`);
    sql.push(`  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),`);
    sql.push(`  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`);
    sql.push(`);`);
    sql.push("");

    sql.push(`CREATE UNIQUE INDEX IF NOT EXISTS ${q("ux_" + m.table + "_code")}`);
    sql.push(`  ON expenses.${q(m.table)}(${q(m.code)})`);
    sql.push(`  WHERE ${q(m.code)} IS NOT NULL`);
    sql.push(`    AND btrim(${q(m.code)}::text) <> '';`);
    sql.push("");

    sql.push(`CREATE UNIQUE INDEX IF NOT EXISTS ${q("ux_" + m.table + "_name")}`);
    sql.push(`  ON expenses.${q(m.table)}(${q(m.name)});`);
    sql.push("");

    sql.push(`INSERT INTO expenses.${q(m.table)} (${q(m.code)}, ${q(m.name)}, sort_order, is_active)`);
    sql.push(`VALUES`);

    m.rows.forEach((r, idx) => {
      const suffix = idx === m.rows.length - 1 ? "" : ",";
      sql.push(`  (${lit(r[0])}, ${lit(r[1])}, ${Number(r[2])}, TRUE)${suffix}`);
    });

    sql.push(`ON CONFLICT (${q(m.name)}) DO UPDATE`);
    sql.push(`SET`);
    sql.push(`  ${q(m.code)} = EXCLUDED.${q(m.code)},`);
    sql.push(`  sort_order = EXCLUDED.sort_order,`);
    sql.push(`  is_active = EXCLUDED.is_active,`);
    sql.push(`  updated_at = now();`);
    sql.push("");
  }

  sql.push("COMMIT;");
  sql.push("");

  return sql.join("\r\n");
}

async function main() {
  const sql = createSql();

  fs.mkdirSync(path.dirname(migrationDst), { recursive: true });
  fs.mkdirSync(path.dirname(migrationAfter), { recursive: true });

  fs.writeFileSync(migrationDst, sql, "utf8");
  fs.writeFileSync(migrationAfter, sql, "utf8");

  const out = [];
  out.push("==============================");
  out.push("契約・保険・リース 不足マスタ14個 作成確認");
  out.push("==============================");
  out.push("日時: " + new Date().toISOString());
  out.push("");
  out.push("[生成SQL]");
  out.push(migrationDst);
  out.push("");

  try {
    await db.query(sql);
  } catch (err) {
    out.push("[SQL実行エラー]");
    out.push("message=" + (err.message || ""));
    out.push("position=" + (err.position || ""));
    out.push("code=" + (err.code || ""));
    out.push("");

    if (err.position) {
      const lc = lineColFromPosition(sql, err.position);
      out.push(`[位置] line=${lc.line} / col=${lc.col}`);
      out.push("");
      out.push("[周辺SQL]");
      out.push(...numberedContext(sql, lc.line, 12));
    } else {
      out.push(String(err.stack || err));
    }

    fs.writeFileSync(checkResultPath, out.join("\r\n"), "utf8");
    throw err;
  }

  for (const m of masters) {
    const exists = await db.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = 'expenses'
        AND table_name = $1
    `, [m.table]);

    const count = await db.query(`
      SELECT COUNT(*)::text AS count
      FROM expenses.${q(m.table)}
    `);

    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'expenses'
        AND table_name = $1
      ORDER BY ordinal_position
    `, [m.table]);

    out.push("");
    out.push("========================================");
    out.push(`expenses.${m.table}`);
    out.push("========================================");
    out.push(`exists=${exists.rows.length > 0 ? "yes" : "no"}`);
    out.push(`count=${count.rows[0].count}`);
    out.push("[columns]");
    for (const row of columns.rows) {
      out.push(`${row.column_name} / ${row.data_type} / nullable=${row.is_nullable}`);
    }
  }

  fs.writeFileSync(checkResultPath, out.join("\r\n"), "utf8");

  await db.end();
}

main().catch(async err => {
  try { await db.end(); } catch {}
  process.exit(1);
});