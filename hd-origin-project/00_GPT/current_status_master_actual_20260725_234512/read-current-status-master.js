const path = require("path");

async function main() {
  const webDir = process.argv[2];
  const db = require(path.join(webDir, "src", "db.js"));

  const columns = await db.query(`
    SELECT
      column_name,
      ordinal_position,
      data_type
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'payment_document_current_statuses'
    ORDER BY ordinal_position
  `);

  const rows = await db.query(`
    SELECT *
    FROM accounting.payment_document_current_statuses
    ORDER BY current_status
  `);

  console.log("============================================================");
  console.log("証憑 current_status マスタ現物確認");
  console.log("============================================================");
  console.log("CONNECTION_MODE=READ_ONLY");
  console.log("DATABASE_UPDATE=NO");
  console.log("TABLE=accounting.payment_document_current_statuses");
  console.log("");

  console.log("【列】");
  for (const row of columns.rows) {
    console.log(
      "COLUMN=" + row.column_name +
      " / POSITION=" + row.ordinal_position +
      " / TYPE=" + row.data_type
    );
  }

  console.log("");
  console.log("【登録値】");
  console.log("RECORD_COUNT=" + rows.rowCount);

  for (const row of rows.rows) {
    console.log(JSON.stringify(row));
  }

  const values = rows.rows.map(row => String(row.current_status || ""));

  console.log("");
  console.log("OCR済_REGISTERED=" + values.includes("OCR済"));
  console.log("OCR待ち_REGISTERED=" + values.includes("OCR待ち"));
  console.log("基礎解析待ち_REGISTERED=" + values.includes("基礎解析待ち"));
  console.log("基礎解析中_REGISTERED=" + values.includes("基礎解析中"));
  console.log("専門解析待ち_REGISTERED=" + values.includes("専門解析待ち"));
  console.log("専門解析中_REGISTERED=" + values.includes("専門解析中"));
  console.log("ユーザー確認待ち_REGISTERED=" + values.includes("ユーザー確認待ち"));
  console.log("台帳_REGISTERED=" + values.includes("台帳"));
  console.log("エラー_REGISTERED=" + values.includes("エラー"));
  console.log("OVERALL_STATUS=SUCCESS");

  if (typeof db.end === "function") {
    await db.end();
  }
}

main().catch(error => {
  console.error("OVERALL_STATUS=FAILED");
  console.error("ERROR_TYPE=" + (error?.constructor?.name || "Error"));
  console.error("ERROR_MESSAGE=" + (error?.message || String(error)));
  process.exitCode = 1;
});