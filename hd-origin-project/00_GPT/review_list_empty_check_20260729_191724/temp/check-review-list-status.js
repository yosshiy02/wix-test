"use strict";

const db = require("./src/db");

function print(name, value) {
  const text =
    typeof value === "string"
      ? value
      : JSON.stringify(value, null, 2);

  process.stdout.write(name + "=" + text + "\n");
}

async function getColumns(tableName) {
  const result = await db.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'accounting'
        AND table_name = $1
      ORDER BY ordinal_position
    `,
    [tableName]
  );

  return result.rows.map(row => String(row.column_name || ""));
}

async function main() {
  const ocrTable =
    "payment_document_ocr_imports";

  const basicTable =
    "payment_document_basic_analysis_results";

  const ocrColumns =
    await getColumns(ocrTable);

  const basicColumns =
    await getColumns(basicTable);

  print(
    "OCR_TABLE_EXISTS",
    ocrColumns.length > 0
  );

  print(
    "BASIC_TABLE_EXISTS",
    basicColumns.length > 0
  );

  if (!ocrColumns.length) {
    throw new Error(
      "accounting.payment_document_ocr_importsが見つかりません。"
    );
  }

  if (!basicColumns.length) {
    throw new Error(
      "accounting.payment_document_basic_analysis_resultsが見つかりません。"
    );
  }

  const companyIdSql =
    ocrColumns.includes("company_id")
      ? "o.company_id"
      : "NULL::bigint";

  const companyCodeSql =
    ocrColumns.includes("company_code")
      ? "o.company_code"
      : "NULL::text";

  const deletedSql =
    ocrColumns.includes("deleted_at")
      ? "o.deleted_at IS NULL"
      : "TRUE";

  const ocrTextSql =
    ocrColumns.includes("ocr_raw_text")
      ? "COALESCE(o.ocr_raw_text, '') <> ''"
      : "TRUE";

  const statusResult = await db.query(
    `
      SELECT
        ${companyIdSql} AS company_id,
        ${companyCodeSql} AS company_code,
        COALESCE(
          o.current_status,
          '(NULL)'
        ) AS current_status,
        COUNT(*)::integer AS row_count
      FROM accounting.payment_document_ocr_imports o
      WHERE ${deletedSql}
        AND ${ocrTextSql}
      GROUP BY
        ${companyIdSql},
        ${companyCodeSql},
        COALESCE(
          o.current_status,
          '(NULL)'
        )
      ORDER BY
        ${companyIdSql} NULLS LAST,
        current_status
    `
  );

  print(
    "CURRENT_STATUS_COUNTS",
    statusResult.rows
  );

  const basicCompletedCount =
    statusResult.rows
      .filter(
        row =>
          row.current_status ===
          "基礎解析済み"
      )
      .reduce(
        (total, row) =>
          total +
          Number(row.row_count || 0),
        0
      );

  const specialistWaitingCount =
    statusResult.rows
      .filter(
        row =>
          row.current_status ===
          "専門解析待ち"
      )
      .reduce(
        (total, row) =>
          total +
          Number(row.row_count || 0),
        0
      );

  const basicOcrIdColumn =
    basicColumns.includes(
      "payment_document_ocr_import_id"
    )
      ? "payment_document_ocr_import_id"
      : "";

  if (!basicOcrIdColumn) {
    throw new Error(
      "基礎解析結果テーブルにOCR取込ID列がありません。"
    );
  }

  const basicIdColumn =
    [
      "payment_document_basic_analysis_id",
      "basic_analysis_id"
    ].find(
      name =>
        basicColumns.includes(name)
    ) || "";

  const analysisSystemSql =
    basicColumns.includes(
      "analysis_system_code"
    )
      ? "b.analysis_system_code"
      : "NULL::text";

  const orderParts = [];

  if (
    basicColumns.includes("is_current")
  ) {
    orderParts.push(
      "b.is_current DESC NULLS LAST"
    );
  }

  if (
    basicColumns.includes("created_at")
  ) {
    orderParts.push(
      "b.created_at DESC NULLS LAST"
    );
  }

  if (basicIdColumn) {
    orderParts.push(
      "b." + basicIdColumn + " DESC"
    );
  }

  if (!orderParts.length) {
    orderParts.push(
      "b.payment_document_ocr_import_id DESC"
    );
  }

  const targetResult = await db.query(
    `
      SELECT
        o.payment_document_ocr_import_id,
        ${companyIdSql} AS company_id,
        ${companyCodeSql} AS company_code,
        o.current_status,
        latest_basic.analysis_system_code
      FROM accounting.payment_document_ocr_imports o

      LEFT JOIN LATERAL (
        SELECT
          ${analysisSystemSql}
            AS analysis_system_code
        FROM accounting.payment_document_basic_analysis_results b
        WHERE
          b.${basicOcrIdColumn} =
          o.payment_document_ocr_import_id
        ORDER BY
          ${orderParts.join(", ")}
        LIMIT 1
      ) latest_basic
        ON TRUE

      WHERE ${deletedSql}
        AND ${ocrTextSql}
        AND o.current_status IN (
          '基礎解析済み',
          '専門解析待ち'
        )

      ORDER BY
        o.current_status,
        o.payment_document_ocr_import_id
    `
  );

  print(
    "TARGET_ROWS",
    targetResult.rows
  );

  const basicRows =
    targetResult.rows.filter(
      row =>
        row.current_status ===
        "基礎解析済み"
    );

  const waitingRows =
    targetResult.rows.filter(
      row =>
        row.current_status ===
        "専門解析待ち"
    );

  const basicWithoutRoute =
    basicRows.filter(
      row =>
        !String(
          row.analysis_system_code || ""
        ).trim()
    );

  const waitingWithoutRoute =
    waitingRows.filter(
      row =>
        !String(
          row.analysis_system_code || ""
        ).trim()
    );

  print(
    "BASIC_COMPLETED_COUNT",
    basicCompletedCount
  );

  print(
    "SPECIALIST_WAITING_COUNT",
    specialistWaitingCount
  );

  print(
    "BASIC_COMPLETED_WITHOUT_ANALYSIS_SYSTEM_COUNT",
    basicWithoutRoute.length
  );

  print(
    "SPECIALIST_WAITING_WITHOUT_ANALYSIS_SYSTEM_COUNT",
    waitingWithoutRoute.length
  );

  if (
    basicCompletedCount === 0 &&
    specialistWaitingCount > 0
  ) {
    print(
      "CAUSE_CODE",
      "EXISTING_ROWS_ALREADY_SPECIALIST_WAITING"
    );

    print(
      "DIAGNOSIS",
      "基礎解析済みが0件で、既存レコードが専門解析待ちに入っています。仕分け一覧が専門解析待ちを除外したため、一覧が空になっています。"
    );
  } else if (
    basicCompletedCount > 0
  ) {
    print(
      "CAUSE_CODE",
      "BASIC_ROWS_EXIST_BUT_NOT_DISPLAYED"
    );

    print(
      "DIAGNOSIS",
      "DBには基礎解析済みが存在します。一覧APIの会社条件または取得条件の確認が必要です。"
    );
  } else {
    print(
      "CAUSE_CODE",
      "NO_BASIC_OR_SPECIALIST_WAITING_ROWS"
    );

    print(
      "DIAGNOSIS",
      "基礎解析済み・専門解析待ちの対象レコードが存在しません。"
    );
  }

  print(
    "DATABASE_UPDATE",
    "NO"
  );

  print(
    "OVERALL_STATUS",
    "SUCCESS"
  );
}

main()
  .then(async () => {
    if (
      db &&
      typeof db.end === "function"
    ) {
      await db.end();
    }

    process.exit(0);
  })
  .catch(async error => {
    print(
      "ERROR_TYPE",
      error &&
      error.constructor
        ? error.constructor.name
        : "Error"
    );

    print(
      "ERROR_MESSAGE",
      error &&
      error.message
        ? error.message
        : String(error)
    );

    print(
      "DATABASE_UPDATE",
      "NO"
    );

    print(
      "OVERALL_STATUS",
      "FAILED"
    );

    try {
      if (
        db &&
        typeof db.end === "function"
      ) {
        await db.end();
      }
    } catch {}

    process.exit(1);
  });