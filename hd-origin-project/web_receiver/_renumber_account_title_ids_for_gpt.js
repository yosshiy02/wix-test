const fs = require("fs");
const pool = require("./src/db");

const outPath = "G:\\GITHUB\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\memo\\00_勘定科目ID並べ直し結果.txt";
const OFFSET = 100000;

function q(sql) {
  return sql.join(" ");
}

async function main() {
  const client = await pool.connect();
  const lines = [];

  try {
    lines.push("==============================");
    lines.push("勘定科目ID並べ直し結果");
    lines.push("==============================");

    await client.query("BEGIN");

    const before = await client.query(
      q([
        "SELECT account_title_id, account_code, account_name, sort_order, is_active",
        "FROM expenses.account_titles",
        "ORDER BY account_title_id"
      ])
    );

    lines.push("");
    lines.push("並べ直し前:");
    lines.push("OLD_ID\tCODE\tACTIVE\tSORT\tNAME");

    for (const row of before.rows) {
      lines.push([
        row.account_title_id,
        row.account_code || "",
        row.is_active ? "ON" : "OFF",
        row.sort_order ?? "",
        row.account_name
      ].join("\t"));
    }

    const mapping = before.rows.map((row, index) => ({
      oldId: Number(row.account_title_id),
      newId: index + 1,
      name: row.account_name
    }));

    const refBefore = await client.query(
      q([
        "SELECT account_title_id, COUNT(*)::int AS count",
        "FROM expenses.expense_details",
        "WHERE account_title_id IS NOT NULL",
        "GROUP BY account_title_id",
        "ORDER BY account_title_id"
      ])
    );

    lines.push("");
    lines.push("expense_details 参照状況:");
    if (refBefore.rowCount === 0) {
      lines.push("参照データなし");
    } else {
      for (const row of refBefore.rows) {
        lines.push("account_title_id=" + row.account_title_id + " count=" + row.count);
      }
    }

    lines.push("");
    lines.push("ID対応表:");
    lines.push("OLD_ID\tNEW_ID\tNAME");

    for (const m of mapping) {
      lines.push([m.oldId, m.newId, m.name].join("\t"));
    }

    // 一時IDへ逃がす。主キー重複を避けるため。
    for (const m of mapping) {
      await client.query(
        "UPDATE expenses.expense_details SET account_title_id = $2 WHERE account_title_id = $1",
        [m.oldId, m.oldId + OFFSET]
      );
    }

    for (const m of mapping) {
      await client.query(
        "UPDATE expenses.account_titles SET account_title_id = $2 WHERE account_title_id = $1",
        [m.oldId, m.oldId + OFFSET]
      );
    }

    // 最終IDへ戻す。
    for (const m of mapping) {
      await client.query(
        "UPDATE expenses.account_titles SET account_title_id = $2 WHERE account_title_id = $1",
        [m.oldId + OFFSET, m.newId]
      );
    }

    for (const m of mapping) {
      await client.query(
        "UPDATE expenses.expense_details SET account_title_id = $2 WHERE account_title_id = $1",
        [m.oldId + OFFSET, m.newId]
      );
    }

    // 次回追加IDを 46 以降にする。
    const seq = await client.query(
      "SELECT pg_get_serial_sequence('expenses.account_titles', 'account_title_id') AS seq"
    );

    if (seq.rows[0] && seq.rows[0].seq) {
      await client.query("SELECT setval($1, $2, true)", [seq.rows[0].seq, mapping.length]);
      lines.push("");
      lines.push("シーケンス更新: 次回IDは " + (mapping.length + 1) + " から");
    } else {
      lines.push("");
      lines.push("シーケンス未検出: 手動確認が必要");
    }

    await client.query("COMMIT");

    const after = await client.query(
      q([
        "SELECT account_title_id, account_code, account_name, sort_order, is_active",
        "FROM expenses.account_titles",
        "ORDER BY account_title_id"
      ])
    );

    lines.push("");
    lines.push("並べ直し後:");
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
    lines.push("OK: 勘定科目IDを 1 から並べ直しました。");
    lines.push("件数: " + after.rowCount);
  } catch (err) {
    await client.query("ROLLBACK");
    lines.push("");
    lines.push("NG: 勘定科目ID並べ直しに失敗しました。ROLLBACK済みです。");
    lines.push(err.stack || String(err));
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    fs.writeFileSync(outPath, lines.join("\r\n"), "utf8");
  }
}

main();
