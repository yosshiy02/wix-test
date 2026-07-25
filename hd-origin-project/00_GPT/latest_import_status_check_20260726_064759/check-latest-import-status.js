const path = require("path");

async function main() {
  const webDir = process.argv[2];
  const db = require(path.join(webDir, "src", "db.js"));

  const masterResolved = await db.query(`
    WITH ocr_phase AS (
      SELECT MAX(display_order) AS last_ocr_order
      FROM accounting.payment_document_current_statuses
      WHERE is_active = TRUE
        AND (
          current_status LIKE 'OCR%'
          OR COALESCE(description, '') LIKE '%OCR%'
        )
    )
    SELECT current_status
    FROM accounting.payment_document_current_statuses
    CROSS JOIN ocr_phase
    WHERE is_active = TRUE
      AND is_processing = FALSE
      AND is_terminal = FALSE
      AND is_error = FALSE
      AND display_order > ocr_phase.last_ocr_order
    ORDER BY display_order
    LIMIT 1
  `);

  const reviewStatus =
    masterResolved.rows[0]?.current_status || "(未解決)";

  const latest = await db.query(`
    SELECT
      payment_document_ocr_import_id,
      original_file_name,
      saved_file_name,
      current_status,
      ocr_status,
      process_status,
      save_status,
      ocr_text_length,
      created_at,
      updated_at,
      saved_at
    FROM accounting.payment_document_ocr_imports
    WHERE deleted_at IS NULL
    ORDER BY
      payment_document_ocr_import_id DESC
    LIMIT 10
  `);

  console.log("============================================================");
  console.log("直近取込証憑・表示対象確認");
  console.log("============================================================");
  console.log("CONNECTION_MODE=READ_ONLY");
  console.log("DATABASE_UPDATE=NO");
  console.log("MASTER_RESOLVED_REVIEW_STATUS=" + reviewStatus);
  console.log("");

  for (const row of latest.rows) {
    const displayTarget =
      row.current_status === reviewStatus &&
      String(row.ocr_text_length || "") !== "0";

    console.log(
      "ID=" + row.payment_document_ocr_import_id +
      " / FILE=" +
        (row.original_file_name || row.saved_file_name || "") +
      " / CURRENT_STATUS=" + (row.current_status || "(NULL)") +
      " / OCR_STATUS=" + (row.ocr_status || "") +
      " / PROCESS_STATUS=" + (row.process_status || "") +
      " / SAVE_STATUS=" + (row.save_status || "") +
      " / OCR_LENGTH=" + (row.ocr_text_length ?? "") +
      " / REVIEW_DISPLAY_TARGET=" + displayTarget
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
  console.error("ERROR_TYPE=" + (error?.constructor?.name || "Error"));
  console.error("ERROR_MESSAGE=" + (error?.message || String(error)));
  process.exitCode = 1;
});