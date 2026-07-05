const pool = require("./src/db");

async function main() {
  const out = [];

  out.push("==============================");
  out.push("レシートAI 目的が出ない切り分け");
  out.push("==============================");
  out.push("日時: " + new Date().toLocaleString("ja-JP"));
  out.push("");

  const latest = await pool.query(`
    SELECT
      d.id AS draft_id,
      d.receipt_import_id,
      d.purpose_id,
      d.purpose_temp_name,
      d.project_id,
      d.project_temp_name,
      d.department_id,
      d.department_temp_name,
      d.account_title_name,
      d.confidence,
      d.ai_raw_json,
      d.created_at,
      d.updated_at
    FROM accounting.receipt_ai_drafts d
    ORDER BY d.id DESC
    LIMIT 5
  `);

  out.push("[最新AI下書き 5件]");
  for (const row of latest.rows) {
    const raw = row.ai_raw_json || {};

    out.push("");
    out.push("draft_id: " + row.draft_id);
    out.push("receipt_import_id: " + row.receipt_import_id);
    out.push("DB purpose_id: " + String(row.purpose_id ?? ""));
    out.push("DB purpose_temp_name: " + String(row.purpose_temp_name ?? ""));
    out.push("AI raw purposeId: " + String(raw.purposeId ?? raw.purpose_id ?? ""));
    out.push("AI raw purposeName: " + String(raw.purposeName ?? raw.purpose_name ?? ""));
    out.push("AI raw resolvedPurposeId: " + String(raw.masterHintsUsed?.resolvedPurposeId ?? raw.resolvedPurposeId ?? ""));
    out.push("AI raw resolvedPurposeName: " + String(raw.masterHintsUsed?.resolvedPurposeName ?? raw.resolvedPurposeName ?? ""));
    out.push("account_title_name: " + String(row.account_title_name ?? ""));
    out.push("confidence: " + String(row.confidence ?? ""));
    out.push("created_at: " + row.created_at);
  }

  out.push("");
  out.push("[目的マスタ]");
  const purposes = await pool.query(`
    SELECT purpose_id, purpose_name, is_active, sort_order
    FROM expenses.purposes
    ORDER BY is_active DESC, sort_order, purpose_id
  `);

  for (const row of purposes.rows) {
    out.push(
      String(row.purpose_id).padStart(3, " ") +
      " / " +
      (row.is_active ? "有効" : "無効") +
      " / " +
      row.purpose_name
    );
  }

  console.log(out.join("\n"));
}

main()
  .catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
