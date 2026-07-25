const fs = require("fs");
const path = require("path");

async function main() {
  const webDir = process.argv[2];
  const undoSqlFile = process.argv[3];
  const db = require(path.join(webDir, "src", "db.js"));
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const masterBefore = await client.query(`
      SELECT *
      FROM accounting.payment_document_current_statuses
      ORDER BY display_order
    `);

    const resolved = await client.query(`
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

    const reviewStatus = resolved.rows[0]?.current_status;

    if (!reviewStatus) {
      throw new Error(
        "ステータスマスタからOCR後の表示先を解決できませんでした。"
      );
    }

    const before = await client.query(`
      SELECT
        payment_document_ocr_import_id,
        current_status
      FROM accounting.payment_document_ocr_imports
      WHERE deleted_at IS NULL
        AND ocr_status = 'ocr_done'
        AND COALESCE(ocr_raw_text, '') <> ''
        AND current_status <> $1
      ORDER BY payment_document_ocr_import_id
    `, [reviewStatus]);

    const undoStatements = before.rows.map(row => {
      const id = Number(row.payment_document_ocr_import_id);
      const oldStatus = String(row.current_status || "")
        .replace(/'/g, "''");

      return [
        "UPDATE accounting.payment_document_ocr_imports",
        "SET current_status = '" + oldStatus + "',",
        "    updated_at = CURRENT_TIMESTAMP",
        "WHERE payment_document_ocr_import_id = " + id + ";"
      ].join("\n");
    });

    fs.writeFileSync(
      undoSqlFile,
      undoStatements.length
        ? "BEGIN;\n\n" +
          undoStatements.join("\n\n") +
          "\n\nCOMMIT;\n"
        : "-- 更新対象なし\n",
      { encoding: "utf8" }
    );

    const updated = await client.query(`
      UPDATE accounting.payment_document_ocr_imports
      SET
        current_status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE deleted_at IS NULL
        AND ocr_status = 'ocr_done'
        AND COALESCE(ocr_raw_text, '') <> ''
        AND current_status <> $1
      RETURNING
        payment_document_ocr_import_id,
        original_file_name,
        current_status,
        ocr_status
    `, [reviewStatus]);

    const display = await client.query(`
      SELECT
        payment_document_ocr_import_id,
        original_file_name,
        current_status,
        ocr_status,
        ocr_text_length
      FROM accounting.payment_document_ocr_imports
      WHERE deleted_at IS NULL
        AND COALESCE(ocr_raw_text, '') <> ''
        AND current_status = $1
      ORDER BY payment_document_ocr_import_id DESC
    `, [reviewStatus]);

    const masterAfter = await client.query(`
      SELECT *
      FROM accounting.payment_document_current_statuses
      ORDER BY display_order
    `);

    if (
      JSON.stringify(masterBefore.rows) !==
      JSON.stringify(masterAfter.rows)
    ) {
      throw new Error(
        "ステータスマスタに意図しない変更が発生しました。"
      );
    }

    await client.query("COMMIT");

    console.log("============================================================");
    console.log("既存証憑 current_status マスタ駆動更新");
    console.log("============================================================");
    console.log("MASTER_UPDATE=NO");
    console.log("RESOLVED_REVIEW_STATUS=" + reviewStatus);
    console.log("UPDATED_RECORD_COUNT=" + updated.rowCount);
    console.log("REVIEW_DISPLAY_COUNT=" + display.rowCount);
    console.log("");

    for (const row of updated.rows) {
      console.log(
        "UPDATED_ID=" + row.payment_document_ocr_import_id +
        " / FILE=" + (row.original_file_name || "") +
        " / CURRENT_STATUS=" + row.current_status +
        " / OCR_STATUS=" + row.ocr_status
      );
    }

    console.log("");
    console.log("STATUS_MASTER_UNCHANGED=YES");
    console.log("DATABASE_UPDATE=SUCCESS");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();

    if (typeof db.end === "function") {
      await db.end();
    }
  }
}

main().catch(error => {
  console.error("DATABASE_UPDATE=FAILED");
  console.error("ERROR_TYPE=" + (error?.constructor?.name || "Error"));
  console.error("ERROR_MESSAGE=" + (error?.message || String(error)));
  process.exitCode = 1;
});