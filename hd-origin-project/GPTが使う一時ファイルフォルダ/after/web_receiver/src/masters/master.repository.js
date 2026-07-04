const pool = require("../db");

const MASTER_DEFS = {
  account_titles: {
    type: "account_titles",
    label: "勘定科目",
    table: "expenses.account_titles",
    idColumn: "account_title_id",
    nameColumn: "account_name",
    extraColumns: ["account_code"],
    extraColumnLabels: {
      account_code: "科目コード"
    },
    note: "紙の勘定科目スタンプを元に整備するマスタです。過去伝票に使うため、削除ではなく使用停止を基本にします。科目区分・通常借方/貸方は後でDB拡張します。"
  },
  payment_methods: {
    type: "payment_methods",
    label: "支払方法",
    table: "expenses.payment_methods",
    idColumn: "payment_method_id",
    nameColumn: "method_name",
    extraColumns: ["default_credit_account"],
    extraColumnLabels: {
      default_credit_account: "通常貸方科目"
    }
  },
  tax_categories: {
    type: "tax_categories",
    label: "税区分",
    table: "expenses.tax_categories",
    idColumn: "tax_category_id",
    nameColumn: "tax_name",
    extraColumns: ["tax_rate"],
    extraColumnLabels: {
      tax_rate: "税率"
    }
  },
  vendors: {
    type: "vendors",
    label: "支払先",
    table: "expenses.vendors",
    idColumn: "vendor_id",
    nameColumn: "vendor_name",
    extraColumns: []
  },
  target_people: {
    type: "target_people",
    label: "対象者",
    table: "expenses.target_people",
    idColumn: "target_person_id",
    nameColumn: "target_person_name",
    extraColumns: []
  },
  purposes: {
    type: "purposes",
    label: "目的",
    table: "expenses.purposes",
    idColumn: "purpose_id",
    nameColumn: "purpose_name",
    extraColumns: []
  },
  projects: {
    type: "projects",
    label: "案件",
    table: "expenses.projects",
    idColumn: "project_id",
    nameColumn: "project_name",
    extraColumns: []
  },
  departments: {
    type: "departments",
    label: "部門",
    table: "expenses.departments",
    idColumn: "department_id",
    nameColumn: "department_name",
    extraColumns: []
  },
  invoice_types: {
    type: "invoice_types",
    label: "インボイス区分",
    table: "expenses.invoice_types",
    idColumn: "invoice_type_id",
    nameColumn: "invoice_type_name",
    extraColumns: []
  },
  evidence_types: {
    type: "evidence_types",
    label: "証憑区分",
    table: "expenses.evidence_types",
    idColumn: "evidence_type_id",
    nameColumn: "evidence_type_name",
    extraColumns: []
  }
};

function getDef(type) {
  const def = MASTER_DEFS[type];

  if (!def) {
    const err = new Error(`未対応のマスタです: ${type}`);
    err.statusCode = 400;
    throw err;
  }

  return def;
}

function quoteIdent(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

function quoteTable(tableName) {
  return String(tableName)
    .split(".")
    .map(quoteIdent)
    .join(".");
}

function normalizeRow(def, row) {
  return {
    ...row,
    id: row[def.idColumn],
    name: row[def.nameColumn],
    type: def.type,
    label: def.label,
    id_column: def.idColumn,
    name_column: def.nameColumn
  };
}

function normalizePayload(def, payload) {
  const name = String(
    payload[def.nameColumn] ??
    payload.name ??
    payload.master_name ??
    ""
  ).trim();

  if (!name) {
    throw new Error("名称が未入力です。");
  }

  const data = {
    [def.nameColumn]: name,
    sort_order: Number(payload.sort_order ?? 0),
    is_active: payload.is_active === undefined ? true : Boolean(payload.is_active)
  };

  for (const col of def.extraColumns) {
    if (payload[col] !== undefined) {
      data[col] = payload[col];
    }
  }

  return data;
}

async function listMasterTypes() {
  return Object.values(MASTER_DEFS).map(def => ({
    type: def.type,
    label: def.label,
    table: def.table,
    id_column: def.idColumn,
    name_column: def.nameColumn,
    extra_columns: def.extraColumns,
    extra_column_labels: def.extraColumnLabels || {},
    has_memo: false,
    note: def.note || ""
  }));
}

async function listMasters(type) {
  const def = getDef(type);
  const table = quoteTable(def.table);

  const columns = [
    def.idColumn,
    def.nameColumn,
    "is_active",
    "sort_order",
    ...def.extraColumns
  ];

  const result = await pool.query(`
    SELECT ${columns.map(quoteIdent).join(", ")}
    FROM ${table}
    ORDER BY is_active DESC, sort_order, ${quoteIdent(def.idColumn)}
  `);

  return result.rows.map(row => normalizeRow(def, row));
}

async function createMaster(type, payload) {
  const def = getDef(type);
  const table = quoteTable(def.table);
  const data = normalizePayload(def, payload);

  const columns = Object.keys(data);
  const values = Object.values(data);
  const params = values.map((_, i) => `$${i + 1}`);

  const updateColumns = columns
    .filter(col => col !== def.nameColumn)
    .map(col => `${quoteIdent(col)} = EXCLUDED.${quoteIdent(col)}`);

  if (!updateColumns.includes('"is_active" = EXCLUDED."is_active"')) {
    updateColumns.push(`${quoteIdent("is_active")} = TRUE`);
  }

  const result = await pool.query(
    `
    INSERT INTO ${table} (${columns.map(quoteIdent).join(", ")})
    VALUES (${params.join(", ")})
    ON CONFLICT (${quoteIdent(def.nameColumn)})
    DO UPDATE SET ${updateColumns.join(", ")}
    RETURNING *
    `,
    values
  );

  return normalizeRow(def, result.rows[0]);
}

async function updateMaster(type, id, payload) {
  const def = getDef(type);
  const table = quoteTable(def.table);

  const allowed = [
    def.nameColumn,
    "name",
    "sort_order",
    "is_active",
    ...def.extraColumns
  ];

  const data = {};

  for (const key of allowed) {
    if (payload[key] !== undefined) {
      if (key === "name") {
        data[def.nameColumn] = String(payload[key] || "").trim();
      } else if (key === "sort_order") {
        data[key] = Number(payload[key] || 0);
      } else {
        data[key] = payload[key];
      }
    }
  }

  if (data[def.nameColumn] !== undefined && !String(data[def.nameColumn]).trim()) {
    throw new Error("名称が未入力です。");
  }

  const columns = Object.keys(data);

  if (!columns.length) {
    throw new Error("更新内容がありません。");
  }

  const sets = columns.map((col, i) => `${quoteIdent(col)} = $${i + 1}`);
  const values = columns.map(col => data[col]);
  values.push(id);

  const result = await pool.query(
    `
    UPDATE ${table}
    SET ${sets.join(", ")}
    WHERE ${quoteIdent(def.idColumn)} = $${values.length}
    RETURNING *
    `,
    values
  );

  if (!result.rows[0]) {
    const err = new Error("更新対象がありません。");
    err.statusCode = 404;
    throw err;
  }

  return normalizeRow(def, result.rows[0]);
}

async function disableMaster(type, id) {
  const def = getDef(type);
  const table = quoteTable(def.table);

  const result = await pool.query(
    `
    UPDATE ${table}
    SET is_active = FALSE
    WHERE ${quoteIdent(def.idColumn)} = $1
    RETURNING *
    `,
    [id]
  );

  if (!result.rows[0]) {
    const err = new Error("削除対象がありません。");
    err.statusCode = 404;
    throw err;
  }

  return normalizeRow(def, result.rows[0]);
}

module.exports = {
  MASTER_DEFS,
  listMasterTypes,
  listMasters,
  createMaster,
  updateMaster,
  disableMaster
};

