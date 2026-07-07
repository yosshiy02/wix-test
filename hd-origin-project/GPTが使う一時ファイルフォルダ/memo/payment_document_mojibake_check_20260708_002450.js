const fs = require("fs");
const path = require("path");

const projectRoot = ;
process.chdir(projectRoot);

require(path.join(projectRoot, "web_receiver", "src", "config.js"));
const db = require(path.join(projectRoot, "web_receiver", "src", "db.js"));

const out = ;

function line(text = "") {
  lines.push(String(text));
}

const lines = [];

(async () => {
  try {
    const enc = await db.query("SHOW server_encoding");
    const clientEnc = await db.query("SHOW client_encoding");

    line("==============================");
    line("支払書類 文字化け切り分け確認");
    line("==============================");
    line("日時: " + new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
    line("");
    line("[DB encoding]");
    line("server_encoding: " + enc.rows[0].server_encoding);
    line("client_encoding: " + clientEnc.rows[0].client_encoding);
    line("");

    const r = await db.query(
      SELECT
        d.payment_document_sorting_draft_id,
        d.payment_document_ocr_import_id,
        d.document_type_code,
        d.document_type_label,
        d.payment_destination_code,
        d.payment_destination_label,
        d.specialist_route_code,
        d.specialist_route_label,
        d.ai_confidence_label,
        d.original_file_name,
        LEFT(d.ocr_raw_text, 120) AS ocr_preview,
        o.original_file_name AS ocr_original_file_name
      FROM accounting.payment_document_sorting_drafts d
      JOIN accounting.payment_document_ocr_imports o
        ON o.payment_document_ocr_import_id = d.payment_document_ocr_import_id
      WHERE d.is_current = TRUE
        AND d.deleted_at IS NULL
      ORDER BY d.payment_document_sorting_draft_id DESC
      LIMIT 11
    );

    line("[Node pg で読んだDB内容]");
    line("※ここが日本語で見えれば psql/PowerShell 表示だけの問題");
    line("※ここも文字化けなら DB保存時点で文字化けしています");
    line("");

    for (const row of r.rows) {
      line("---- draft_id: " + row.payment_document_sorting_draft_id + " / ocr_id: " + row.payment_document_ocr_import_id + " ----");
      line("original_file_name: " + row.original_file_name);
      line("ocr_original_file_name: " + row.ocr_original_file_name);
      line("document_type_code: " + row.document_type_code);
      line("document_type_label: " + row.document_type_label);
      line("payment_destination_code: " + row.payment_destination_code);
      line("payment_destination_label: " + row.payment_destination_label);
      line("specialist_route_code: " + row.specialist_route_code);
      line("specialist_route_label: " + row.specialist_route_label);
      line("ai_confidence_label: " + row.ai_confidence_label);
      line("ocr_preview: " + row.ocr_preview);
      line("");
    }

    fs.writeFileSync(out, lines.join("\r\n"), "utf8");
    await db.end();
  } catch (err) {
    lines.push("");
    lines.push("[ERROR]");
    lines.push(err.stack || err.message || String(err));
    fs.writeFileSync(out, lines.join("\r\n"), "utf8");
    try { await db.end(); } catch {}
    process.exitCode = 1;
  }
})();
