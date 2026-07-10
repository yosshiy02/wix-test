const path = require("path");

(async () => {
  const projectRoot = "C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project";

  const pool = require(
    path.join(
      projectRoot,
      "web_receiver",
      "src",
      "db"
    )
  );

  const checkSql = [
    "SELECT",
    "  column_name,",
    "  data_type",
    "FROM information_schema.columns",
    "WHERE table_schema = 'accounting'",
    "  AND table_name = 'payable_documents'",
    "  AND column_name IN (",
    "    'company_code',",
    "    'company_name',",
    "    'evidence_status',",
    "    'evidence_due_date',",
    "    'evidence_received_date',",
    "    'review_status',",
    "    'review_reason',",
    "    'warning_level',",
    "    'professional_review_required',",
    "    'professional_review_status',",
    "    'professional_reviewer',",
    "    'professional_reviewed_at',",
    "    'professional_review_result'",
    "  )",
    "ORDER BY ordinal_position"
  ].join("\n");

  const result = await pool.query(checkSql);

  console.log("Added columns:", result.rows.length);

  for (const row of result.rows) {
    console.log(row.column_name, row.data_type);
  }

  if (result.rows.length !== 13) {
    throw new Error(
      "Expected 13 columns but found " +
      result.rows.length
    );
  }

  await pool.end();
})().catch(error => {
  console.error(error);
  process.exit(1);
});