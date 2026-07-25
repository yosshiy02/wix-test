const path = require("path");

async function main() {
  const webDir = process.argv[2];
  const db = require(path.join(webDir, "src", "db.js"));

  const summary = await db.query(`
    SELECT
      COUNT(*) FILTER (
        WHERE deleted_at IS NULL
      ) AS total_active,

      COUNT(*) FILTER (
        WHERE deleted_at IS NULL
          AND COALESCE(ocr_raw_text, '') <> ''
      ) AS review_current_condition_count,

      COUNT(*) FILTER (
        WHERE deleted_at IS NULL
          AND current_status = 'OCR'
      ) AS current_status_ocr_count,

      COUNT(*) FILTER (
        WHERE deleted_at IS NULL
          AND current_status = '基礎解析'
      ) AS current_status_basic_count,

      COUNT(*) FILTER (
        WHERE deleted_at IS NULL
          AND current_status = '専門解析'
      ) AS current_status_specialist_count,

      COUNT(*) FILTER (
        WHERE deleted_at IS NULL
          AND current_status = '台帳'
      ) AS current_status_ledger_count,

      COUNT(*) FILTER (
        WHERE deleted_at IS NULL
          AND current_status IS NULL
      ) AS current_status_null_count,

      COUNT(*) FILTER (
        WHERE deleted_at IS NULL
          AND COALESCE(current_status, '') = ''
      ) AS current_status_blank_count
    FROM accounting.payment_document_ocr_imports
  `);

  const statuses = await db.query(`
    SELECT
      COALESCE(NULLIF(current_status, ''), '(NULL_OR_BLANK)') AS current_status,
      COUNT(*) AS record_count
    FROM accounting.payment_document_ocr_imports
    WHERE deleted_at IS NULL
    GROUP BY COALESCE(NULLIF(current_status, ''), '(NULL_OR_BLANK)')
    ORDER BY record_count DESC, current_status
  `);

  const reviewItems = await db.query(`
    SELECT
      payment_document_ocr_import_id,
      original_file_name,
      saved_file_name,
      current_status,
      ocr_status,
      process_status,
      save_status,
      ocr_text_length,
      saved_at,
      sorted_at
    FROM accounting.payment_document_ocr_imports
    WHERE deleted_at IS NULL
      AND COALESCE(ocr_raw_text, '') <> ''
    ORDER BY
      sorted_at DESC NULLS LAST,
      saved_at DESC NULLS LAST,
      ocr_at DESC NULLS LAST,
      payment_document_ocr_import_id DESC
    LIMIT 500
  `);

  const lines = [];

  lines.push("============================================================");
  lines.push("OCR証憑 current_status・画面該当件数確認");
  lines.push("============================================================");
  lines.push("CONNECTION_MODE=READ_ONLY");
  lines.push("DATABASE_UPDATE=NO");
  lines.push("");

  const s = summary.rows[0];

  lines.push("TOTAL_ACTIVE=" + s.total_active);
  lines.push("REVIEW_CURRENT_CONDITION_COUNT=" + s.review_current_condition_count);
  lines.push("CURRENT_STATUS_OCR_COUNT=" + s.current_status_ocr_count);
  lines.push("CURRENT_STATUS_BASIC_COUNT=" + s.current_status_basic_count);
  lines.push("CURRENT_STATUS_SPECIALIST_COUNT=" + s.current_status_specialist_count);
  lines.push("CURRENT_STATUS_LEDGER_COUNT=" + s.current_status_ledger_count);
  lines.push("CURRENT_STATUS_NULL_COUNT=" + s.current_status_null_count);
  lines.push("CURRENT_STATUS_BLANK_COUNT=" + s.current_status_blank_count);
  lines.push("");

  lines.push("============================================================");
  lines.push("current_status別件数");
  lines.push("============================================================");

  for (const row of statuses.rows) {
    lines.push(
      "CURRENT_STATUS=" + row.current_status +
      " / RECORD_COUNT=" + row.record_count
    );
  }

  lines.push("");
  lines.push("============================================================");
  lines.push("読取内容確認画面・現行条件該当レコード");
  lines.push("============================================================");

  for (const row of reviewItems.rows) {
    lines.push(
      "ID=" + row.payment_document_ocr_import_id +
      " / FILE=" + (row.original_file_name || row.saved_file_name || "") +
      " / CURRENT_STATUS=" + (row.current_status ?? "(NULL)") +
      " / OCR_STATUS=" + (row.ocr_status || "") +
      " / PROCESS_STATUS=" + (row.process_status || "") +
      " / SAVE_STATUS=" + (row.save_status || "") +
      " / OCR_LENGTH=" + (row.ocr_text_length ?? "")
    );
  }

  lines.push("");
  lines.push("DISPLAY_RECORD_COUNT=" + reviewItems.rows.length);
  lines.push("OVERALL_STATUS=SUCCESS");

  console.log(lines.join("\n"));

  if (typeof db.end === "function") {
    await db.end();
  }
}

main().catch(error => {
  console.error("============================================================");
  console.error("確認エラー");
  console.error("============================================================");
  console.error("ERROR_TYPE=" + (error?.constructor?.name || "Error"));
  console.error("ERROR_MESSAGE=" + (error?.message || String(error)));
  console.error("OVERALL_STATUS=FAILED");
  process.exitCode = 1;
});