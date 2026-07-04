const fs = require("fs");
const pool = require("./src/db");

const outPath = "G:\\GITHUB\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\memo\\00_勘定科目ID_よく使う順_並べ直し結果.txt";
const OFFSET = 100000;

const priorityNames = [
  "普通預金",
  "当座預金",
  "売掛金",
  "買掛金",
  "未払金",
  "預り金",
  "仮払金",
  "前受金",
  "受取手形",
  "支払手形",
  "割引手形",

  "仕入高",
  "原材料",
  "副材料",
  "仕掛品",
  "外注工賃",
  "売上原価",

  "消耗品費",
  "旅費交通費",
  "通信費",
  "水道光熱費",
  "支払手数料",
  "荷造運賃",
  "荷造材料",

  "給料及手当",
  "役員報酬",
  "法定福利費",
  "福利厚生費",

  "地代家賃",
  "家賃地代",
  "接待交際費",
  "会議費",
  "雑費",

  "諸会費",
  "研究費",
  "新聞図書費",
  "印刷費",
  "保険料",
  "修繕費",
  "諸税公課",
  "衛生費",
  "事務費",

  "支払利息",
  "雑収入",
  "広告宣伝費"
];

async function main() {
  const client = await pool.connect();
  const lines = [];

  try {
    lines.push("==============================");
    lines.push("勘定科目ID よく使う順 並べ直し結果");
    lines.push("==============================");

    await client.query("BEGIN");

    const before = await client.query(
      "SELECT account_title_id, account_code, account_name, sort_order, is_active " +
      "FROM expenses.account_titles " +
      "ORDER BY account_title_id"
    );

    lines.push("");
    lines.push("並べ直し前:");
    lines.push("ID\tCODE\tACTIVE\tSORT\tNAME");

    for (const row of before.rows) {
      lines.push([
        row.account_title_id,
        row.account_code || "",
        row.is_active ? "ON" : "OFF",
        row.sort_order ?? "",
        row.account_name
      ].join("\t"));
    }

    const byName = new Map();
    for (const row of before.rows) {
      byName.set(row.account_name, row);
    }

    const ordered = [];

    for (const name of priorityNames) {
      if (byName.has(name)) {
        ordered.push(byName.get(name));
        byName.delete(name);
      }
    }

    // 優先リストに無いものは、今のID順で後ろに残す。
    for (const row of before.rows) {
      if (byName.has(row.account_name)) {
        ordered.push(row);
        byName.delete(row.account_name);
      }
    }

    const mapping = ordered.map((row, index) => ({
      oldId: Number(row.account_title_id),
      newId: index + 1,
      name: row.account_name
    }));

    lines.push("");
    lines.push("ID対応表:");
    lines.push("OLD_ID\tNEW_ID\tNAME");

    for (const m of mapping) {
      lines.push([m.oldId, m.newId, m.name].join("\t"));
    }

    const refBefore = await client.query(
      "SELECT account_title_id, COUNT(*)::int AS count " +
      "FROM expenses.expense_details " +
      "WHERE account_title_id IS NOT NULL " +
      "GROUP BY account_title_id " +
      "ORDER BY account_title_id"
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

    // 一時IDへ逃がす
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

    // 最終IDへ戻す。同時に表示順も10刻みにする。
    for (const m of mapping) {
      await client.query(
        "UPDATE expenses.account_titles SET account_title_id = $2, sort_order = $3 WHERE account_title_id = $1",
        [m.oldId + OFFSET, m.newId, m.newId * 10]
      );
    }

    for (const m of mapping) {
      await client.query(
        "UPDATE expenses.expense_details SET account_title_id = $2 WHERE account_title_id = $1",
        [m.oldId + OFFSET, m.newId]
      );
    }

    const seq = await client.query(
      "SELECT pg_get_serial_sequence('expenses.account_titles', 'account_title_id') AS seq"
    );

    if (seq.rows[0] && seq.rows[0].seq) {
      await client.query("SELECT setval($1, $2, true)", [seq.rows[0].seq, mapping.length]);
      lines.push("");
      lines.push("シーケンス更新: 次回IDは " + (mapping.length + 1) + " から");
    }

    await client.query("COMMIT");

    const after = await client.query(
      "SELECT account_title_id, account_code, account_name, sort_order, is_active " +
      "FROM expenses.account_titles " +
      "ORDER BY account_title_id"
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
    lines.push("OK: 勘定科目IDを、よく使う順に並べ直しました。");
    lines.push("account_code は変更していません。");
    lines.push("sort_order も ID順に 10刻みで整理しました。");
    lines.push("件数: " + after.rowCount);
  } catch (err) {
    await client.query("ROLLBACK");
    lines.push("");
    lines.push("NG: 並べ直しに失敗しました。ROLLBACK済みです。");
    lines.push(err.stack || String(err));
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    fs.writeFileSync(outPath, lines.join("\r\n"), "utf8");
  }
}

main();
