const fs = require("fs");
const pool = require("./src/db");

const outPath = "G:\\GITHUB\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\memo\\00_勘定科目_UTF8直接書き出し確認.txt";

async function main() {
  const result = await pool.query(
    "SELECT " +
    "account_title_id, " +
    "account_code, " +
    "account_name, " +
    "sort_order, " +
    "is_active " +
    "FROM expenses.account_titles " +
    "ORDER BY account_title_id"
  );

  const lines = [];
  lines.push("==============================");
  lines.push("勘定科目 UTF-8直接書き出し確認");
  lines.push("==============================");
  lines.push("ID\tCODE\tACTIVE\tSORT\tNAME");

  for (const row of result.rows) {
    lines.push([
      row.account_title_id,
      row.account_code || "",
      row.is_active ? "ON" : "OFF",
      row.sort_order ?? "",
      row.account_name
    ].join("\t"));
  }

  lines.push("");
  lines.push("件数: " + result.rowCount);
  lines.push("");
  lines.push("確認ポイント:");
  lines.push("- このtxtで日本語が読めれば、DBは正常でPowerShell表示だけの文字化け");
  lines.push("- このtxtでも文字化けしていれば、DB内の科目名が文字化けしている");

  fs.writeFileSync(outPath, lines.join("\r\n"), "utf8");

  await pool.end();
}

main().catch(async err => {
  fs.writeFileSync(outPath, "NG: " + err.stack, "utf8");
  try { await pool.end(); } catch {}
  process.exit(1);
});
