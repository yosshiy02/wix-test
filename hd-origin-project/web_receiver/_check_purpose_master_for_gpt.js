const pool = require("./src/db");

async function main() {
  const out = [];

  out.push("==============================");
  out.push("目的マスタ登録確認");
  out.push("==============================");
  out.push("日時: " + new Date().toLocaleString("ja-JP"));
  out.push("");

  out.push("[出張先打合せ 検索]");
  const hit = await pool.query(`
    SELECT *
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
      out.push(JSON.stringify(row, null, 2));
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
