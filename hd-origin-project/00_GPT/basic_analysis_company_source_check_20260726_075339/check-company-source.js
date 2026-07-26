const path = require("path");

async function main() {
  const webDir = process.argv[2];
  const db = require(path.join(webDir, "src", "db.js"));

  console.log("============================================================");
  console.log("基礎解析 company_id 正式取得元確認");
  console.log("============================================================");
  console.log("CONNECTION_MODE=READ_ONLY");
  console.log("FILE_UPDATE=NO");
  console.log("DATABASE_UPDATE=NO");
  console.log("STATUS_MASTER_UPDATE=NO");
  console.log("");

  console.log("【1. payment_document_ocr_imports 全列】");

  const ocrColumns = await db.query(`
    SELECT
      ordinal_position,
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'payment_document_ocr_imports'
    ORDER BY ordinal_position
  `);

  for (const row of ocrColumns.rows) {
    console.log(
      "COLUMN=" + row.column_name +
      " / TYPE=" + row.data_type +
      " / NULLABLE=" + row.is_nullable
    );
  }

  console.log("");
  console.log("【2. company_idを持つ証憑関連テーブル】");

  const companyTables = await db.query(`
    SELECT
      c.table_schema,
      c.table_name,
      c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'accounting'
      AND c.column_name = 'company_id'
      AND (
        c.table_name ILIKE '%payment_document%'
        OR c.table_name ILIKE '%ocr%'
        OR c.table_name ILIKE '%document%'
      )
    ORDER BY c.table_name
  `);

  for (const row of companyTables.rows) {
    console.log(
      "TABLE=" + row.table_schema + "." + row.table_name +
      " / COLUMN=" + row.column_name
    );
  }

  console.log("");
  console.log("【3. basic_analysis_results 外部キー】");

  const foreignKeys = await db.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'accounting'
      AND tc.table_name = 'payment_document_basic_analysis_results'
    ORDER BY kcu.column_name
  `);

  for (const row of foreignKeys.rows) {
    console.log(
      "FK_COLUMN=" + row.column_name +
      " / REFERENCES=" +
      row.foreign_table_schema + "." +
      row.foreign_table_name + "." +
      row.foreign_column_name
    );
  }

  console.log("");
  console.log("【4. OCR取込ID 28～55の実レコード】");

  const ocrRows = await db.query(`
    SELECT *
    FROM accounting.payment_document_ocr_imports
    WHERE payment_document_ocr_import_id BETWEEN 28 AND 55
      AND deleted_at IS NULL
    ORDER BY payment_document_ocr_import_id
  `);

  console.log("OCR_ROW_COUNT=" + ocrRows.rowCount);

  for (const row of ocrRows.rows) {
    const picked = {};

    for (const [key, value] of Object.entries(row)) {
      if (
        key.includes("company") ||
        key.includes("owner") ||
        key.includes("tenant") ||
        key.includes("organization") ||
        key.includes("source") ||
        key.includes("import") ||
        key.includes("document") ||
        key === "current_status"
      ) {
        picked[key] = value;
      }
    }

    console.log(JSON.stringify(picked));
  }

  console.log("");
  console.log("【5. company_id関連FK一覧】");

  const companyForeignKeys = await db.query(`
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'accounting'
      AND kcu.column_name = 'company_id'
    ORDER BY tc.table_name
  `);

  for (const row of companyForeignKeys.rows) {
    console.log(
      "TABLE=" + row.table_schema + "." + row.table_name +
      " / COLUMN=" + row.column_name +
      " / REFERENCES=" +
      row.foreign_table_schema + "." +
      row.foreign_table_name + "." +
      row.foreign_column_name
    );
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