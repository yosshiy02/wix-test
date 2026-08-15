const pool = require("../db");

const MASTER_DEFS = {
  account_titles: {
    type: "account_titles",
    label: "勘定項目",
    table: "マスターテーブル.勘定項目マスタテーブル",
    idColumn: "account_title_id",
    nameColumn: "account_name",
    extraColumns: [],
    orderColumn: "account_title_id",
    conflictColumn: "account_name",
    columnMap: { account_title_id: "勘定項目ID", account_name: "勘定項目名", is_active: "勘定項目有効" },
    orderAlias: false,
    skipOrderWrite: true
  },
  payment_methods: {
    type: "payment_methods",
    label: "支払方法",
    table: "\"マスターテーブル\".payment_methods",
    idColumn: "payment_method_id",
    nameColumn: "method_name",
    extraColumns: ["payment_method_code", "default_credit_account"]
  },
  tax_categories: {
    type: "tax_categories",
    label: "税区分",
    table: "\"マスターテーブル\".tax_categories",
    idColumn: "tax_category_id",
    nameColumn: "tax_name",
    extraColumns: ["tax_category_code", "tax_rate"]
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
    table: "\"マスターテーブル\".target_people",
    idColumn: "target_person_id",
    nameColumn: "target_person_name",
    extraColumns: []
  },
  purposes: {
    type: "purposes",
    label: "目的",
    table: "\"マスターテーブル\".purposes",
    idColumn: "purpose_id",
    nameColumn: "purpose_name",
    extraColumns: []
  },
  projects: {
    type: "projects",
    label: "案件",
    table: "\"マスターテーブル\".projects",
    idColumn: "project_id",
    nameColumn: "project_name",
    extraColumns: []
  },
  departments: {
    type: "departments",
    label: "部門",
    table: "\"マスターテーブル\".departments",
    idColumn: "department_id",
    nameColumn: "department_name",
    extraColumns: []
  },
  companies: {
    type: "companies",
    label: "会社",
    table: "マスターテーブル.自社会社マスターテーブル",
    idColumn: "company_id",
    nameColumn: "company_name",
    extraColumns: ["company_code", "company_short_name"],
    orderColumn: "sort_order",
    conflictColumn: "company_code",
    columnMap: { company_id: "自社会社ID", company_code: "自社会社コード", company_name: "自社会社名", company_short_name: "自社会社略称名", sort_order: "自社会社表示順", is_active: "自社会社有効" }
  },
  people: {
    type: "people",
    label: "人物",
    table: "\"マスターテーブル\".people",
    idColumn: "person_id",
    nameColumn: "person_name",
    extraColumns: ["person_code"]
  },
  positions: {
    type: "positions",
    label: "役職",
    table: "\"マスターテーブル\".positions",
    idColumn: "position_id",
    nameColumn: "position_name",
    extraColumns: ["position_code"]
  },
  permissions: {
    type: "permissions",
    label: "権限",
    table: "\"マスターテーブル\".permissions",
    idColumn: "permission_id",
    nameColumn: "permission_name",
    extraColumns: ["permission_code", "permission_level"]
  },  document_types: {
    type: "document_types",
    label: "書類区分",
    table: "マスターテーブル.書類種別マスタテーブル",
    idColumn: "document_type_id",
    nameColumn: "document_type_name",
    extraColumns: ["document_type_code", "description"],
    orderColumn: "display_order",
    conflictColumn: "document_type_code",
    columnMap: { document_type_id: "書類種別ID", document_type_code: "書類種別英語名", document_type_name: "書類種別名", display_order: "書類種別表示順", is_active: "書類種別有効", description: "書類種別説明" }
  },
  payment_destinations: {
    type: "payment_destinations",
    label: "処理先",
    table: "\"マスターテーブル\".payment_destinations",
    idColumn: "payment_destination_id",
    nameColumn: "payment_destination_name",
    extraColumns: ["payment_destination_code"]
  },
    analysis_systems: {
    type: "analysis_systems",
    label: "専門解析先",
    table: "\"マスターテーブル\".payment_document_specialist_analyses",
    idColumn: "specialist_analysis_id",
    nameColumn: "specialist_analysis_name",
    extraColumns: [
      "specialist_analysis_code",
      "description",
      "destination_url"
    ]
  },
  accounting_categories: {
    type: "accounting_categories",
    label: "会計区分",
    table: "\"マスターテーブル\".accounting_categories",
    idColumn: "accounting_category_id",
    nameColumn: "accounting_category_name",
    extraColumns: ["accounting_category_code"]
  },
  payable_kinds: {
    type: "payable_kinds",
    label: "未払種別",
    table: "\"マスターテーブル\".payable_kinds",
    idColumn: "payable_kind_id",
    nameColumn: "payable_kind_name",
    extraColumns: ["payable_kind_code"]
  },
  payment_source_types: {
    type: "payment_source_types",
    label: "入手元区分",
    table: "\"マスターテーブル\".payment_source_types",
    idColumn: "payment_source_type_id",
    nameColumn: "payment_source_type_name",
    extraColumns: ["payment_source_type_code"]
  },

  /* GPT00_PAYABLE_COMMON_MASTERS_20260711_START */
  payable_statuses: {
    type: "payable_statuses",
    label: "未払状態",
    table: "\"マスターテーブル\".payable_statuses",
    idColumn: "payable_status_id",
    nameColumn: "payable_status_name",
    extraColumns: [
      "payable_status_code"
    ]
  },
  evidence_statuses: {
    type: "evidence_statuses",
    label: "証憑状態",
    table: "\"マスターテーブル\".evidence_statuses",
    idColumn: "evidence_status_id",
    nameColumn: "evidence_status_name",
    extraColumns: [
      "evidence_status_code"
    ]
  },
  review_statuses: {
    type: "review_statuses",
    label: "確認状態",
    table: "\"マスターテーブル\".review_statuses",
    idColumn: "review_status_id",
    nameColumn: "review_status_name",
    extraColumns: [
      "review_status_code"
    ]
  },
  warning_levels: {
    type: "warning_levels",
    label: "警告レベル",
    table: "\"マスターテーブル\".warning_levels",
    idColumn: "warning_level_id",
    nameColumn: "warning_level_name",
    extraColumns: [
      "warning_level_code"
    ]
  },
  professional_review_statuses: {
    type: "professional_review_statuses",
    label: "専門家確認状態",
    table:
      "\"マスターテーブル\".professional_review_statuses",
    idColumn:
      "professional_review_status_id",
    nameColumn:
      "professional_review_status_name",
    extraColumns: [
      "professional_review_status_code"
    ]
  },
  /* GPT00_PAYABLE_COMMON_MASTERS_20260711_END */
  invoice_types: {
    type: "invoice_types",
    label: "インボイス区分",
    table: "\"マスターテーブル\".invoice_types",
    idColumn: "invoice_type_id",
    nameColumn: "invoice_type_name",
    extraColumns: ["invoice_type_code"]
  },
  evidence_types: {
    type: "evidence_types",
    label: "証憑区分",
    table: "\"マスターテーブル\".evidence_types",
    idColumn: "evidence_type_id",
    nameColumn: "evidence_type_name",
    extraColumns: ["evidence_type_code"]
  },
  contract_insurance_lease_kinds: {
    type: "contract_insurance_lease_kinds",
    label: "契約・保険・リース",
    table: "\"マスターテーブル\".contract_insurance_lease_kinds",
    idColumn: "contract_insurance_lease_kind_id",
    nameColumn: "contract_insurance_lease_kind_name",
    extraColumns: ["contract_insurance_lease_kind_code"]
  },
  lease_item_categories: {
    type: "lease_item_categories",
    label: "リース物件区分",
    table: "\"マスターテーブル\".lease_item_categories",
    idColumn: "lease_item_category_id",
    nameColumn: "lease_item_category_name",
    extraColumns: ["lease_item_category_code"]
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

function mappedMasterColumn(def, logicalColumn) {
  return def.columnMap?.[logicalColumn] || logicalColumn;
}

function mappedMasterSelect(def, logicalColumn) {
  const physicalColumn = mappedMasterColumn(def, logicalColumn);
  return `${quoteIdent(physicalColumn)} AS ${quoteIdent(logicalColumn)}`;
}

function normalizeMappedMasterRow(def, row) {
  return {
    ...row,
    ...(def.orderAlias === false ? {} : {
      sort_order: row.sort_order ?? row[def.orderColumn || "sort_order"]
    }),
    id: row[def.idColumn],
    name: row[def.nameColumn],
    type: def.type,
    label: def.label,
    id_column: def.idColumn,
    name_column: def.nameColumn
  };
}

async function listMappedMaster(def) {
  const logicalColumns = [
    def.idColumn,
    def.nameColumn,
    "is_active",
    ...def.extraColumns
  ];
  const orderColumn = def.orderColumn || "sort_order";
  const physicalOrderColumn = mappedMasterColumn(def, orderColumn);
  const selectColumns = logicalColumns.map(column => mappedMasterSelect(def, column));
  if (def.orderAlias !== false) {
    selectColumns.push(`${quoteIdent(physicalOrderColumn)} AS ${quoteIdent("sort_order")}`);
  }
  const result = await pool.query(`
    SELECT ${selectColumns.join(", ")}
    FROM ${quoteTable(def.table)}
    ORDER BY ${quoteIdent(mappedMasterColumn(def, "is_active"))} DESC,
      ${quoteIdent(physicalOrderColumn)},
      ${quoteIdent(mappedMasterColumn(def, def.idColumn))}
  `);
  return result.rows.map(row => normalizeMappedMasterRow(def, row));
}
async function createMappedMaster(def, payload) {
  const data = normalizePayload(def, payload);
  if (def.skipOrderWrite) delete data[def.orderColumn];
  const columns = Object.keys(data);
  const physicalColumns = columns.map(column => mappedMasterColumn(def, column));
  const values = Object.values(data);
  const params = values.map((_, index) => `$${index + 1}`);
  const updates = columns
    .filter(column => column !== def.nameColumn)
    .map(column => {
      const physical = quoteIdent(mappedMasterColumn(def, column));
      return `${physical} = EXCLUDED.${physical}`;
    });
  const active = quoteIdent(mappedMasterColumn(def, "is_active"));
  if (!updates.includes(`${active} = EXCLUDED.${active}`)) updates.push(`${active} = TRUE`);
  const result = await pool.query(`
    INSERT INTO ${quoteTable(def.table)} (${physicalColumns.map(quoteIdent).join(", ")})
    VALUES (${params.join(", ")})
    ON CONFLICT (${quoteIdent(mappedMasterColumn(def, def.conflictColumn || def.nameColumn))})
    DO UPDATE SET ${updates.join(", ")}
    RETURNING *
  `, values);
  return normalizeMappedMasterRow(def, result.rows[0]);
}

async function updateMappedMaster(def, id, payload) {
  const orderColumn = def.orderColumn || "sort_order";
  const allowed = [
    def.nameColumn,
    "name",
    ...(def.skipOrderWrite ? [] : ["sort_order"]),
    "is_active",
    ...def.extraColumns
  ];
  const data = {};
  for (const key of allowed) {
    if (payload[key] === undefined) continue;
    if (key === "name") data[def.nameColumn] = String(payload[key] || "").trim();
    else if (key === "sort_order") data[orderColumn] = Number(payload[key] || 0);
    else data[key] = payload[key];
  }
  if (data[def.nameColumn] !== undefined && !String(data[def.nameColumn]).trim()) throw new Error("名称は必須です。");
  const columns = Object.keys(data);
  if (!columns.length) throw new Error("更新対象がありません。");
  const values = columns.map(column => data[column]);
  values.push(id);
  const result = await pool.query(`
    UPDATE ${quoteTable(def.table)}
    SET ${columns.map((column, index) => `${quoteIdent(mappedMasterColumn(def, column))} = $${index + 1}`).join(", ")}
    WHERE ${quoteIdent(mappedMasterColumn(def, def.idColumn))} = $${values.length}
    RETURNING *
  `, values);
  if (!result.rows[0]) {
    const error = new Error("更新対象がありません。");
    error.statusCode = 404;
    throw error;
  }
  return normalizeMappedMasterRow(def, result.rows[0]);
}

async function disableMappedMaster(def, id) {
  const result = await pool.query(`
    UPDATE ${quoteTable(def.table)}
    SET ${quoteIdent(mappedMasterColumn(def, "is_active"))} = FALSE
    WHERE ${quoteIdent(mappedMasterColumn(def, def.idColumn))} = $1
    RETURNING *
  `, [id]);
  if (!result.rows[0]) {
    const error = new Error("無効化対象がありません。");
    error.statusCode = 404;
    throw error;
  }
  return normalizeMappedMasterRow(def, result.rows[0]);
}
function normalizeRow(def, row) {
  return {
    ...row,
    sort_order: row.sort_order ?? row[def.orderColumn || "sort_order"],
    id: row[def.idColumn],
    name: row[def.nameColumn],
    type: def.type,
    label: def.label,
    id_column: def.idColumn,
    name_column: def.nameColumn
  };
}

function normalizePayload(def, payload) {
  const orderColumn = def.orderColumn || "sort_order";
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
    [orderColumn]: Number(payload.sort_order ?? payload[orderColumn] ?? 0),
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
    extra_columns: def.extraColumns
  }));
}

async function listMasters(type) {
  const def = getDef(type);
  if (def.columnMap) return listMappedMaster(def);
  const table = quoteTable(def.table);
  const orderColumn = def.orderColumn || "sort_order";

  const columns = [
    def.idColumn,
    def.nameColumn,
    "is_active",
    ...def.extraColumns
  ];
  const orderSelect = orderColumn === "sort_order"
    ? quoteIdent(orderColumn)
    : `${quoteIdent(orderColumn)} AS ${quoteIdent("sort_order")}`;

  const result = await pool.query(`
    SELECT ${[...columns.map(quoteIdent), orderSelect].join(", ")}
    FROM ${table}
    ORDER BY is_active DESC, ${quoteIdent(orderColumn)}, ${quoteIdent(def.idColumn)}
  `);

  return result.rows.map(row => normalizeRow(def, row));
}

async function createMaster(type, payload) {
  const def = getDef(type);
  if (def.columnMap) return createMappedMaster(def, payload);
  const table = quoteTable(def.table);
  const conflictColumn = def.conflictColumn || def.nameColumn;
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
    ON CONFLICT (${quoteIdent(conflictColumn)})
    DO UPDATE SET ${updateColumns.join(", ")}
    RETURNING *
    `,
    values
  );

  return normalizeRow(def, result.rows[0]);
}

async function updateMaster(type, id, payload) {
  const def = getDef(type);
  if (def.columnMap) return updateMappedMaster(def, id, payload);
  const table = quoteTable(def.table);
  const orderColumn = def.orderColumn || "sort_order";

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
        data[orderColumn] = Number(payload[key] || 0);
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
  if (def.columnMap) return disableMappedMaster(def, id);
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



