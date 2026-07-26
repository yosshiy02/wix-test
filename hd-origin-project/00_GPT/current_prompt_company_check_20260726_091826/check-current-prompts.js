const path = require("path");

function quoteIdent(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

async function main() {
  const webDir = process.argv[2];
  const db = require(path.join(webDir, "src", "db.js"));

  console.log("============================================================");
  console.log("現在のAIプロンプト company_id指示確認");
  console.log("============================================================");

  const tableExists = await db.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'accounting'
        AND table_name = 'ai_prompt_definitions'
    ) AS exists
  `);

  console.log(
    "AI_PROMPT_DEFINITIONS_EXISTS=" +
    tableExists.rows[0].exists
  );

  if (!tableExists.rows[0].exists) {
    throw new Error(
      "accounting.ai_prompt_definitionsが存在しません。"
    );
  }

  const columns = await db.query(`
    SELECT
      ordinal_position,
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'ai_prompt_definitions'
    ORDER BY ordinal_position
  `);

  console.log("");
  console.log("【1. ai_prompt_definitions列】");
  console.log("COLUMN_COUNT=" + columns.rowCount);

  for (const row of columns.rows) {
    console.log(
      "COLUMN=" + row.column_name +
      " / TYPE=" + row.data_type +
      " / NULLABLE=" + row.is_nullable
    );
  }

  const textColumns = columns.rows
    .filter(row =>
      row.data_type === "text" ||
      row.data_type === "character varying" ||
      row.data_type === "character"
    )
    .map(row => row.column_name);

  console.log("");
  console.log("TEXT_COLUMN_COUNT=" + textColumns.length);

  if (!textColumns.length) {
    throw new Error(
      "検索可能な文字列列がありません。"
    );
  }

  const searchTerms = [
    "company_id",
    "companyId",
    "company_code",
    "companyCode",
    "HD_ORIGIN_STYLE",
    "対象会社",
    "会社ID",
    "会社コード"
  ];

  const conditions = [];

  for (const columnName of textColumns) {
    const column = quoteIdent(columnName);

    for (const term of searchTerms) {
      conditions.push(
        `COALESCE(${column}::text, '') ILIKE ` +
        `'%${term.replace(/'/g, "''")}%'`
      );
    }
  }

  const result = await db.query(`
    SELECT *
    FROM accounting.ai_prompt_definitions
    WHERE ${conditions.join(" OR ")}
    ORDER BY 1
  `);

  console.log("");
  console.log("【2. 会社指示を含む登録プロンプト】");
  console.log("MATCH_COUNT=" + result.rowCount);

  let companyIdPromptCount = 0;
  let hdOriginStyleCount = 0;

  for (const row of result.rows) {
    const json = JSON.stringify(row);
    const lower = json.toLowerCase();

    if (
      lower.includes("company_id") ||
      lower.includes("companyid") ||
      json.includes("会社ID")
    ) {
      companyIdPromptCount++;
    }

    if (
      json.includes("HD_ORIGIN_STYLE") ||
      json.includes("株式会社HDオリジンスタイル")
    ) {
      hdOriginStyleCount++;
    }

    console.log("");
    console.log("----------------------------------------");
    console.log(JSON.stringify(row, null, 2));
  }

  console.log("");
  console.log("【3. 集計】");
  console.log(
    "COMPANY_ID_PROMPT_ROW_COUNT=" +
    companyIdPromptCount
  );
  console.log(
    "HD_ORIGIN_STYLE_PROMPT_ROW_COUNT=" +
    hdOriginStyleCount
  );

  if (result.rowCount === 0) {
    console.log(
      "RESULT=現在の登録プロンプトに会社関連指示は見つかりません"
    );
  } else if (
    companyIdPromptCount > 0 &&
    hdOriginStyleCount > 0
  ) {
    console.log(
      "RESULT=company_id指示とHD_ORIGIN_STYLE指定の両方があります"
    );
  } else if (companyIdPromptCount > 0) {
    console.log(
      "RESULT=company_id指示はありますがHD_ORIGIN_STYLE指定は確認できません"
    );
  } else {
    console.log(
      "RESULT=会社関連指示はありますがcompany_id明示は確認できません"
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