const fs = require("fs");
const path = require("path");

(async () => {
  const projectRoot = "C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project";
  const migrationPath = "C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\after\\GPT_payable_control_A_20260710_202518.after.20260710_001_payable_control_fields.sql";

  const pool = require(
    path.join(
      projectRoot,
      "web_receiver",
      "src",
      "db"
    )
  );

  const sql = fs.readFileSync(
    migrationPath,
    "utf8"
  );

  await pool.query(sql);

  const result = await pool.query(
    SELECT
      company_code,
      company_name,
      evidence_status,
      evidence_due_date,
      evidence_received_date,
      review_status,
      review_reason,
      warning_level,
      professional_review_required,
      professional_review_status,
      professional_reviewer,
      professional_reviewed_at,
      professional_review_result
    FROM accounting.payable_documents
    LIMIT 0
  );

  console.log(
    "Migration OK:",
    result.fields.map(field => field.name).join(", ")
  );

  await pool.end();
})().catch(error => {
  console.error(error);
  process.exit(1);
});