"use strict";

const pool = require('C:/Users/yossh.2FLABO/Desktop/新しいフォルダー/wix-test/hd-origin-project/web_receiver/src/db.js');

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN READ ONLY");

    const sql = [
      "SELECT",
      "  psa.specialist_analysis_id,",
      "  psa.specialist_analysis_code,",
      "  ai.analysis_item_id,",
      "  ai.analysis_item_code,",
      "  ai.analysis_item_name,",
      "  sai.is_required,",
      "  sai.is_recommended,",
      "  sai.display_order,",
      "  sai.is_active",
      "FROM accounting.payment_document_specialist_analyses psa",
      "INNER JOIN accounting.specialist_analysis_items sai",
      "  ON sai.specialist_analysis_id = psa.specialist_analysis_id",
      "INNER JOIN accounting.analysis_items ai",
      "  ON ai.analysis_item_id = sai.analysis_item_id",
      "WHERE psa.specialist_analysis_code = $1",
      "  AND sai.is_active = TRUE",
      "  AND ai.is_active = TRUE",
      "ORDER BY",
      "  sai.display_order,",
      "  ai.analysis_item_id"
    ].join("\n");

    const result = await client.query(
      sql,
      ["bank_transaction"]
    );

    console.log(
      "DB_ANALYSIS_ITEM_COUNT=" +
      result.rows.length
    );

    for (const row of result.rows) {
      console.log(
        "DB_ANALYSIS_ITEM" +
        " ORDER=" + row.display_order +
        " ID=" + row.analysis_item_id +
        " CODE=" + row.analysis_item_code +
        " NAME=" + row.analysis_item_name +
        " REQUIRED=" + row.is_required +
        " RECOMMENDED=" + row.is_recommended
      );
    }

    const uniqueCodes = new Set(
      result.rows.map(function (row) {
        return String(
          row.analysis_item_code || ""
        );
      })
    );

    console.log(
      "DB_UNIQUE_ANALYSIS_ITEM_CODE_COUNT=" +
      uniqueCodes.size
    );

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