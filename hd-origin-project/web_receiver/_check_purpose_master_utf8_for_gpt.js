const fs = require("fs");
const path = require("path");
const pool = require("./src/db");

const outPath = process.argv[2];

async function main() {
  const out = [];

  out.push("==============================");
  out.push("目的マスタ登録確認 UTF-8");
  out.push("==============================");
  out.push("日時: " + new Date().toLocaleString("ja-JP"));
  out.push("");

  out.push("[出張先・打合せ・会議 検索]");
  const hit = await pool.query(`
    SELECT purpose_id, purpose_name, is_active, sort_order, created_at
    FROM expenses.purposes
    WHERE purpose_name LIKE '%出張先%'
       OR purpose_name LIKE '%打合%'
       OR purpose_name LIKE '%打ち合わせ%'
       OR purpose_name LIKE '%会議%'
    ORDER BY purpose_id
  `);

  if (hit.rows.length === 0) {
    out.push("該当なし");
  } else {
    for (const row of hit.rows) {
      out.push(
        row.purpose_id +
        " / " +
        (row.is_active ? "有効" : "無効") +
        " / " +
        row.purpose_name +
        " / sort=" +
        row.sort_order +
        " / created_at=" +
        row.created_at
      );
    }
  }

  out.push("");
  out.push("[目的マスタ 全件]");
  const all = await pool.query(`
    SELECT purpose_id, purpose_name, is_active, sort_order
    FROM expenses.purposes
    ORDER BY is_active DESC, sort_order, purpose_id
  `);

  for (const row of all.rows) {
    out.push(
      String(row.purpose_id).padStart(3, " ") +
      " / " +
      (row.is_active ? "有効" : "無効") +
      " / " +
      row.purpose_name +
      " / sort=" +
      row.sort_order
    );
  }

  fs.writeFileSync(outPath, out.join("\r\n"), "utf8");
}

main()
  .catch((error) => {
    fs.writeFileSync(
      outPath,
      String(error.stack || error.message || error),
      "utf8"
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
