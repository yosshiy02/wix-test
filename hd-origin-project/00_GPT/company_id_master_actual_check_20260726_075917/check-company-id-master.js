const path = require("path");

async function main() {
  const webDir = process.argv[2];
  const db = require(path.join(webDir, "src", "db.js"));

  console.log("============================================================");
  console.log("company_id マスタ定義 現物確認");
  console.log("============================================================");
  console.log("CONNECTION_MODE=READ_ONLY");
  console.log("FILE_UPDATE=NO");
  console.log("DATABASE_UPDATE=NO");
  console.log("STATUS_MASTER_UPDATE=NO");
  console.log("");

  console.log("【1. マスタ候補テーブル一覧】");

  const candidateTables = await db.query(`
    SELECT DISTINCT
      c.table_schema,
      c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'accounting'
      AND (
        c.table_name ILIKE '%master%'
        OR c.table_name ILIKE '%item%'
        OR c.table_name ILIKE '%field%'
        OR c.table_name ILIKE '%analysis%'
        OR c.table_name ILIKE '%mapping%'
        OR c.table_name ILIKE '%definition%'
      )
    ORDER BY c.table_name
  `);

  console.log("CANDIDATE_TABLE_COUNT=" + candidateTables.rowCount);

  for (const row of candidateTables.rows) {
    console.log(
      "TABLE=" +
      row.table_schema +
      "." +
      row.table_name
    );
  }

  console.log("");
  console.log("【2. company_id・会社項目を検索可能な列】");

  const searchableTables = await db.query(`
    SELECT
      c.table_schema,
      c.table_name,
      array_agg(c.column_name ORDER BY c.ordinal_position)
        FILTER (
          WHERE c.data_type IN (
            'text',
            'character varying',
            'character'
          )
        ) AS text_columns
    FROM information_schema.columns c
    WHERE c.table_schema = 'accounting'
      AND (
        c.table_name ILIKE '%master%'
        OR c.table_name ILIKE '%item%'
        OR c.table_name ILIKE '%field%'
        OR c.table_name ILIKE '%analysis%'
        OR c.table_name ILIKE '%mapping%'
        OR c.table_name ILIKE '%definition%'
      )
    GROUP BY
      c.table_schema,
      c.table_name
    HAVING COUNT(*) FILTER (
      WHERE c.data_type IN (
        'text',
        'character varying',
        'character'
      )
    ) > 0
    ORDER BY c.table_name
  `);

  let totalMatches = 0;

  console.log("");
  console.log("【3. company_id・会社のマスタ登録値】");

  for (const table of searchableTables.rows) {
    const schema = table.table_schema;
    const tableName = table.table_name;
    const textColumns = table.text_columns || [];

    if (!textColumns.length) continue;

    const quotedSchema =
      '"' + String(schema).replace(/"/g, '""') + '"';

    const quotedTable =
      '"' + String(tableName).replace(/"/g, '""') + '"';

    const conditions = textColumns.map((columnName) => {
      const quotedColumn =
        '"' + String(columnName).replace(/"/g, '""') + '"';

      return `
        COALESCE(${quotedColumn}::text, '') ILIKE '%company_id%'
        OR COALESCE(${quotedColumn}::text, '') ILIKE '%会社%'
        OR COALESCE(${quotedColumn}::text, '') ILIKE '%法人%'
      `;
    });

    const sql = `
      SELECT *
      FROM ${quotedSchema}.${quotedTable}
      WHERE ${conditions.map(c => "(" + c + ")").join(" OR ")}
      LIMIT 100
    `;

    let result;

    try {
      result = await db.query(sql);
    } catch (error) {
      console.log(
        "SEARCH_ERROR_TABLE=" +
        schema + "." + tableName +
        " / ERROR=" + error.message
      );

      continue;
    }

    if (!result.rows.length) continue;

    totalMatches += result.rows.length;

    console.log("");
    console.log(
      "----- " +
      schema + "." + tableName +
      " / MATCH_COUNT=" +
      result.rows.length +
      " -----"
    );

    for (const row of result.rows) {
      console.log(JSON.stringify(row));
    }
  }

  console.log("");
  console.log("MASTER_ROW_MATCH_TOTAL=" + totalMatches);

  console.log("");
  console.log("【4. company_id列のDBコメント】");

  const comments = await db.query(`
    SELECT
      n.nspname AS table_schema,
      c.relname AS table_name,
      a.attname AS column_name,
      pg_catalog.col_description(
        a.attrelid,
        a.attnum
      ) AS column_comment
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c
      ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace n
      ON n.oid = c.relnamespace
    WHERE n.nspname = 'accounting'
      AND a.attname = 'company_id'
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY c.relname
  `);

  for (const row of comments.rows) {
    console.log(
      "TABLE=" +
      row.table_schema + "." + row.table_name +
      " / COLUMN=" + row.column_name +
      " / COMMENT=" +
      (row.column_comment || "")
    );
  }

  console.log("");
  console.log("【5. companiesマスタ現物】");

  const companiesExists = await db.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'accounting'
        AND table_name = 'companies'
    ) AS exists
  `);

  if (companiesExists.rows[0].exists) {
    const companies = await db.query(`
      SELECT *
      FROM accounting.companies
      ORDER BY company_id
    `);

    console.log("COMPANY_MASTER_ROW_COUNT=" + companies.rowCount);

    for (const row of companies.rows) {
      console.log(JSON.stringify(row));
    }
  } else {
    console.log("COMPANIES_MASTER_EXISTS=FALSE");
  }

  console.log("");
  console.log("OVERALL_STATUS=SUCCESS");

  if (typeof db.end === "function") {
    await db.end();
  }
}

main().catch(error => {
  console.error("OVERALL_STATUS=FAILED");
  console.error(
    "ERROR_TYPE=" +
    (error?.constructor?.name || "Error")
  );
  console.error(
    "ERROR_MESSAGE=" +
    (error?.message || String(error))
  );
  process.exitCode = 1;
});