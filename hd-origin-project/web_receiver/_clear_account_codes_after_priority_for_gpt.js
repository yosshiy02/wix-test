const fs = require("fs");
const pool = require("./src/db");

const outPath = "G:\\GITHUB\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\memo\\00_勘定科目_code_NULL化_並べ直し後結果.txt";

async function main() {
  const client = await pool.connect();
  const lines = [];

  try {
    lines.push("==============================");
    lines.push("勘定科目 account_code NULL化 並べ直し後");
    lines.push("==============================");

    await client.query("BEGIN");

    const update = await client.query(
      "UPDATE expenses.account_titles SET account_code = NULL"
    );

    const after = await client.query(
      "SELECT account_title_id, account_code, account_name, sort_order, is_active " +
      "FROM expenses.account_titles " +
      "ORDER BY account_title_id"
    );

    await client.query("COMMIT");

    lines.push("");
    lines.push("変更件数: " + update.rowCount);
    lines.push("");
    lines.push("変更後:");
    lines.push("ID\tCODE\tACTIVE\tSORT\tNAME");

    for (const row of after.rows) {
      lines.push([
        row.account_title_id,
        row.account_code || "",
        row.is_active ? "ON" : "OFF",
        row.sort_order ?? "",
        row.account_name
      ].join("\t"));
    }

    lines.push("");
    lines.push("OK: account_code をすべて NULL にしました。");
  } catch (err) {
    await client.query("ROLLBACK");
    lines.push("");
    lines.push("NG: 失敗しました。ROLLBACK済みです。");
    lines.push(err.stack || String(err));
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    fs.writeFileSync(outPath, lines.join("\r\n"), "utf8");
  }
}

main();
