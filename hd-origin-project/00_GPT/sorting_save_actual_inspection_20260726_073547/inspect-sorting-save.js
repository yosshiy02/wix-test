const fs = require("fs");
const path = require("path");

async function main() {
  const webDir = process.argv[2];
  const routesFile = process.argv[3];

  const db = require(path.join(webDir, "src", "db.js"));
  const source = fs.readFileSync(routesFile, "utf8");

  console.log("============================================================");
  console.log("基礎解析 保存先・保存API 現物確認");
  console.log("============================================================");
  console.log("CONNECTION_MODE=READ_ONLY");
  console.log("FILE_UPDATE=NO");
  console.log("DATABASE_UPDATE=NO");
  console.log("STATUS_MASTER_UPDATE=NO");
  console.log("");

  const tables = await db.query(`
    SELECT
      table_schema,
      table_name
    FROM information_schema.tables
    WHERE table_schema = 'accounting'
      AND (
        table_name ILIKE '%sorting%'
        OR table_name ILIKE '%basic%analysis%'
      )
    ORDER BY table_name
  `);

  console.log("【候補テーブル】");
  console.log("TABLE_COUNT=" + tables.rowCount);

  for (const table of tables.rows) {
    console.log(
      "TABLE=" +
      table.table_schema +
      "." +
      table.table_name
    );

    const columns = await db.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position
    `, [
      table.table_schema,
      table.table_name
    ]);

    for (const column of columns.rows) {
      console.log(
        "  COLUMN=" + column.column_name +
        " / TYPE=" + column.data_type +
        " / NULLABLE=" + column.is_nullable +
        " / DEFAULT=" + (column.column_default || "")
      );
    }
  }

  console.log("");
  console.log("【コード内保存処理候補】");

  const lines = source.split(/\r?\n/);
  const patterns = [
    /payment_document_sorting_drafts/i,
    /sorting-drafts\/save/i,
    /INSERT\s+INTO\s+accounting\..*sorting/i,
    /UPDATE\s+accounting\.payment_document_ocr_imports/i,
    /latest_sorting/i,
    /sorting_draft/i
  ];

  const found = new Set();

  for (let i = 0; i < lines.length; i++) {
    if (!patterns.some(pattern => pattern.test(lines[i]))) {
      continue;
    }

    const start = Math.max(0, i - 12);
    const end = Math.min(lines.length, i + 30);
    const key = start + ":" + end;

    if (found.has(key)) continue;
    found.add(key);

    console.log("");
    console.log("----- ROUTES LINE " + (i + 1) + " -----");

    for (let j = start; j < end; j++) {
      console.log(
        String(j + 1).padStart(6, " ") +
        ": " +
        lines[j]
      );
    }
  }

  console.log("");
  console.log("SORTING_SAVE_ROUTE_EXISTS=" +
    source.includes("/api/payment-documents/sorting-drafts/save")
  );

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