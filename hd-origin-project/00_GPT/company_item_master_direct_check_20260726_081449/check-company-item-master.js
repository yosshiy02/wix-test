const path = require("path");

function quoteIdent(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

async function printColumns(db, tableName) {
  const result = await db.query(`
    SELECT
      ordinal_position,
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);

  console.log("");
  console.log("----- COLUMNS accounting." + tableName + " -----");
  console.log("COLUMN_COUNT=" + result.rowCount);

  for (const row of result.rows) {
    console.log(
      "COLUMN=" + row.column_name +
      " / TYPE=" + row.data_type +
      " / NULLABLE=" + row.is_nullable
    );
  }

  return result.rows;
}

async function searchTable(db, tableName, columns) {
  const textColumns = columns
    .filter(row =>
      row.data_type === "text" ||
      row.data_type === "character varying" ||
      row.data_type === "character"
    )
    .map(row => row.column_name);

  console.log("");
  console.log("----- SEARCH accounting." + tableName + " -----");
  console.log("TEXT_COLUMN_COUNT=" + textColumns.length);

  if (!textColumns.length) {
    console.log("MATCH_COUNT=0");
    return;
  }

  const conditions = [];

  for (const columnName of textColumns) {
    const column = quoteIdent(columnName);

    conditions.push(
      `COALESCE(${column}::text, '') ILIKE '%company_id%'`
    );

    conditions.push(
      `COALESCE(${column}::text, '') ILIKE '%会社%'`
    );

    conditions.push(
      `COALESCE(${column}::text, '') ILIKE '%法人%'`
    );

    conditions.push(
      `COALESCE(${column}::text, '') ILIKE '%対象会社%'`
    );
  }

  const sql = `
    SELECT *
    FROM accounting.${quoteIdent(tableName)}
    WHERE ${conditions.join(" OR ")}
    ORDER BY 1
    LIMIT 200
  `;

  const result = await db.query(sql);

  console.log("MATCH_COUNT=" + result.rowCount);

  for (const row of result.rows) {
    console.log(JSON.stringify(row));
  }
}

async function main() {
  const webDir = process.argv[2];
  const db = require(path.join(webDir, "src", "db.js"));

  const targetTables = [
    "analysis_items",
    "specialist_analysis_items",
    "analysis_item_categories"
  ];

  console.log("============================================================");
  console.log("解析項目マスタ company_id 直接確認");
  console.log("============================================================");

  for (const tableName of targetTables) {
    const exists = await db.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'accounting'
          AND table_name = $1
      ) AS exists
    `, [tableName]);

    console.log("");
    console.log(
      "TABLE=accounting." +
      tableName +
      " / EXISTS=" +
      exists.rows[0].exists
    );

    if (!exists.rows[0].exists) {
      continue;
    }

    const columns =
      await printColumns(db, tableName);

    await searchTable(
      db,
      tableName,
      columns
    );
  }

  console.log("");
  console.log("============================================================");
  console.log("companiesマスタ現物");
  console.log("============================================================");

  const companies = await db.query(`
    SELECT *
    FROM accounting.companies
    ORDER BY company_id
  `);

  console.log(
    "COMPANY_MASTER_ROW_COUNT=" +
    companies.rowCount
  );

  for (const row of companies.rows) {
    console.log(JSON.stringify(row));
  }

  console.log("");
  console.log("NODE_OVERALL_STATUS=SUCCESS");

  if (typeof db.end === "function") {
    await db.end();
  }
}

main().catch(error => {
  console.error("NODE_OVERALL_STATUS=FAILED");
  console.error(
    "NODE_ERROR_TYPE=" +
    (
      error &&
      error.constructor &&
      error.constructor.name
        ? error.constructor.name
        : "Error"
    )
  );
  console.error(
    "NODE_ERROR_MESSAGE=" +
    (
      error && error.message
        ? error.message
        : String(error)
    )
  );
  console.error(
    "NODE_ERROR_STACK=" +
    (
      error && error.stack
        ? error.stack
        : ""
    )
  );
  process.exitCode = 1;
});