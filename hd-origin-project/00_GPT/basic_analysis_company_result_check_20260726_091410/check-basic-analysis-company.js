const path = require("path");

function findCompanyValues(value, result, currentPath) {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      findCompanyValues(
        item,
        result,
        currentPath + "[" + index + "]"
      );
    });
    return;
  }

  if (typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = currentPath
      ? currentPath + "." + key
      : key;

    const normalizedKey =
      String(key).toLowerCase();

    if (
      normalizedKey === "company_id" ||
      normalizedKey === "companyid" ||
      normalizedKey === "company_code" ||
      normalizedKey === "companycode" ||
      normalizedKey === "company_name" ||
      normalizedKey === "companyname" ||
      normalizedKey === "target_company" ||
      normalizedKey === "target_company_code" ||
      normalizedKey === "target_company_id" ||
      key.includes("会社")
    ) {
      result.push({
        path: childPath,
        key,
        value: child
      });
    }

    findCompanyValues(child, result, childPath);
  }
}

async function main() {
  const webDir = process.argv[2];
  const db = require(path.join(webDir, "src", "db.js"));

  console.log("============================================================");
  console.log("基礎解析 再解析結果 company_id確認");
  console.log("============================================================");

  const result = await db.query(`
    SELECT
      bar.basic_analysis_id,
      bar.payment_document_ocr_import_id,
      bar.company_id,
      c.company_code,
      c.company_name,
      bar.is_current,
      bar.analysis_completed,
      bar.created_at,
      bar.updated_at,
      bar.raw_result_json,
      bar.candidate_masters_snapshot_json,
      bar.output_schema_snapshot_json,
      oi.original_file_name,
      oi.current_status
    FROM accounting.payment_document_basic_analysis_results bar
    LEFT JOIN accounting.companies c
      ON c.company_id = bar.company_id
    JOIN accounting.payment_document_ocr_imports oi
      ON oi.payment_document_ocr_import_id =
         bar.payment_document_ocr_import_id
    ORDER BY
      bar.created_at DESC,
      bar.basic_analysis_id DESC
    LIMIT 50
  `);

  console.log("BASIC_ANALYSIS_ROW_COUNT=" + result.rowCount);

  let dbCompanyIdCount = 0;
  let jsonCompanyValueCount = 0;

  for (const row of result.rows) {
    if (row.company_id !== null) {
      dbCompanyIdCount++;
    }

    const found = [];

    findCompanyValues(
      row.raw_result_json,
      found,
      "raw_result_json"
    );

    findCompanyValues(
      row.candidate_masters_snapshot_json,
      found,
      "candidate_masters_snapshot_json"
    );

    findCompanyValues(
      row.output_schema_snapshot_json,
      found,
      "output_schema_snapshot_json"
    );

    jsonCompanyValueCount += found.length;

    console.log("");
    console.log("----------------------------------------");
    console.log(
      "BASIC_ANALYSIS_ID=" +
      row.basic_analysis_id
    );
    console.log(
      "OCR_IMPORT_ID=" +
      row.payment_document_ocr_import_id
    );
    console.log(
      "FILE_NAME=" +
      row.original_file_name
    );
    console.log(
      "CURRENT_STATUS=" +
      row.current_status
    );
    console.log(
      "DB_COMPANY_ID=" +
      (
        row.company_id === null
          ? "NULL"
          : row.company_id
      )
    );
    console.log(
      "DB_COMPANY_CODE=" +
      (row.company_code || "")
    );
    console.log(
      "DB_COMPANY_NAME=" +
      (row.company_name || "")
    );
    console.log(
      "IS_CURRENT=" +
      row.is_current
    );
    console.log(
      "ANALYSIS_COMPLETED=" +
      row.analysis_completed
    );
    console.log(
      "CREATED_AT=" +
      row.created_at
    );
    console.log(
      "JSON_COMPANY_MATCH_COUNT=" +
      found.length
    );

    for (const item of found) {
      console.log(
        "JSON_COMPANY_VALUE=" +
        JSON.stringify(item)
      );
    }
  }

  console.log("");
  console.log("============================================================");
  console.log("集計");
  console.log("============================================================");
  console.log(
    "DB_COMPANY_ID_NOT_NULL_COUNT=" +
    dbCompanyIdCount
  );
  console.log(
    "JSON_COMPANY_VALUE_TOTAL=" +
    jsonCompanyValueCount
  );

  if (result.rowCount === 0) {
    console.log("RESULT=基礎解析結果レコードなし");
  } else if (
    dbCompanyIdCount === 0 &&
    jsonCompanyValueCount === 0
  ) {
    console.log(
      "RESULT=company_idも会社情報JSONも付いていません"
    );
  } else if (
    dbCompanyIdCount === 0 &&
    jsonCompanyValueCount > 0
  ) {
    console.log(
      "RESULT=AI結果JSONには会社情報あり・DBのcompany_idには未保存"
    );
  } else {
    console.log(
      "RESULT=DBのcompany_idに会社マスタ参照値あり"
    );
  }

  console.log("");
  console.log("NODE_OVERALL_STATUS=SUCCESS");

  if (typeof db.end === "function") {
    await db.end();
  }
}

main().catch(error => {
  console.error("NODE_OVERALL_STATUS=FAILED");
  console.error(
    "NODE_ERROR_TYPE=" +
    (
      error?.constructor?.name ||
      "Error"
    )
  );
  console.error(
    "NODE_ERROR_MESSAGE=" +
    (
      error?.message ||
      String(error)
    )
  );
  console.error(
    "NODE_ERROR_STACK=" +
    (
      error?.stack ||
      ""
    )
  );
  process.exitCode = 1;
});