const pool = require("./src/db");

(async () => {
  const r = await pool.query(`
    SELECT
      id,
      receipt_import_id,
      created_at,
      transaction_date,
      vendor_name,
      total_amount,
      tax_amount,
      payment_method_id,
      payment_method_name,
      account_title_name,
      invoice_type_id,
      evidence_type_id,
      evidence_memo,
      invoice_number,
      summary,
      memo,
      confidence,
      ai_model,
      ai_raw_json
    FROM accounting.receipt_ai_drafts
    ORDER BY id DESC
    LIMIT 1
  `);

  if (r.rows.length === 0) {
    console.log("AI判断結果はまだありません。");
  } else {
    const row = r.rows[0];

    console.log("==============================");
    console.log("最新AI判断結果");
    console.log("==============================");
    console.log("AI下書きID:", row.id);
    console.log("レシート取込ID:", row.receipt_import_id);
    console.log("作成日時:", row.created_at);
    console.log("");
    console.log("日付:", row.transaction_date);
    console.log("支払先:", row.vendor_name);
    console.log("合計:", row.total_amount);
    console.log("税額:", row.tax_amount);
    console.log("");
    console.log("勘定科目候補:", row.account_title_name);
    console.log("支払方法:", row.payment_method_id, row.payment_method_name);
    console.log("インボイス区分ID:", row.invoice_type_id);
    console.log("証憑区分ID:", row.evidence_type_id);
    console.log("証憑メモ:", row.evidence_memo);
    console.log("インボイス番号:", row.invoice_number);
    console.log("");
    console.log("摘要:", row.summary);
    console.log("AIメモ:", row.memo);
    console.log("信頼度:", row.confidence);
    console.log("AIモデル:", row.ai_model);
    console.log("");
    console.log("==============================");
    console.log("AI raw JSON");
    console.log("==============================");
    console.log(JSON.stringify(row.ai_raw_json, null, 2));
  }

  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
