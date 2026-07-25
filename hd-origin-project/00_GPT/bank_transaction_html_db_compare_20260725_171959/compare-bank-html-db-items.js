"use strict";

const pool = require("C:/Users/yossh.2FLABO/Desktop/新しいフォルダー/wix-test/hd-origin-project/web_receiver/src/db.js");

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN READ ONLY");

    const sql = [
      "SELECT ai.analysis_item_code",
      "FROM accounting.payment_document_specialist_analyses psa",
      "INNER JOIN accounting.specialist_analysis_items sai",
      "  ON sai.specialist_analysis_id = psa.specialist_analysis_id",
      "INNER JOIN accounting.analysis_items ai",
      "  ON ai.analysis_item_id = sai.analysis_item_id",
      "WHERE psa.specialist_analysis_code = $1",
      "  AND sai.is_active = TRUE",
      "  AND ai.is_active = TRUE",
      "ORDER BY sai.display_order, ai.analysis_item_id"
    ].join("\n");

    const result = await client.query(
      sql,
      ["bank_transaction"]
    );

    for (const row of result.rows) {
      console.log(
        "DB_CODE=" +
        String(row.analysis_item_code || "")
      );
    }

    await client.query("ROLLBACK");
  }
  catch (error) {
    try {
      await client.query("ROLLBACK");
    }
    catch (rollbackError) {
      console.error(
        "ROLLBACK_ERROR=" +
        rollbackError.message
      );
    }

    throw error;
  }
  finally {
    client.release();
    await pool.end();
  }
}

main().catch(function (error) {
  console.error(
    "NODE_ERROR=" +
    (
      error && error.stack
        ? error.stack
        : String(error)
    )
  );

  process.exitCode = 1;
});