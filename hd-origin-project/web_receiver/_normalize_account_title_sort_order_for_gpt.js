const fs = require("fs");
const pool = require("./src/db");

const outPath = "G:\\GITHUB\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\memo\\00_勘定科目_表示順_ID順整理結果.txt";

async function main() {
  const client = await pool.connect();
  const lines = [];

  try {
    lines.push("==============================");
    lines.push("勘定科目 表示順 ID順整理結果");
    lines.push("==============================");

    await client.query("BEGIN");

    const before = await client.query(
      "SELECT account_title_id, account_name, sort_order " +
      "FROM expenses.account_titles " +
      "ORDER BY account_title_id"
    );

    lines.push("");
    lines.push("変更前:");
    lines.push("ID\tSORT\tNAME");

    for (const row of before.rows) {
      lines.push([row.account_title_id, row.sort_order ?? "", row.account_name].join("\t"));
    }

    for (let i = 0; i < before.rows.length; i++) {
      const row = before.rows[i];
      const newSort = (i + 1) * 10;

      await client.query(
        "UPDATE expenses.account_titles SET sort_order = $1 WHERE account_title_id = $2",
        [newSort, row.account_title_id]
      );
    }

    const after = await client.query(
      "SELECT account_title_id, account_name, sort_order " +
      "FROM expenses.account_titles " +
      "ORDER BY account_title_id"
    );

    await client.query("COMMIT");

    lines.push("");
    lines.push("変更後:");
    lines.push("ID\tSORT\tNAME");

    for (const row of after.rows) {
      lines.push([row.account_title_id, row.sort_order ?? "", row.account_name].join("\t"));
    }

    lines.push("");
    lines.push("OK: 勘定科目の表示順をID順で10刻みに整理しました。");
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
