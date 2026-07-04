const pool = require("./src/db");

const accountTitles = [
  "諸会費",
  "研究費",
  "新聞図書費",
  "印刷費",
  "保険料",
  "修繕費",
  "家賃地代",
  "接待交際費",
  "諸税公課",
  "会議費",
  "衛生費",
  "消耗品費",
  "事務費",
  "雑費",
  "水道光熱費",
  "通信費",
  "荷造材料",
  "給料及手当",
  "役員報酬",
  "法定福利費",
  "福利厚生費",
  "原材料",
  "仕掛品",
  "外注工賃",
  "売上原価",
  "支払手形",
  "割引手形",
  "副材料",
  "前受金",
  "買掛金",
  "未払金",
  "仮払金",
  "預り金",
  "売掛金",
  "当座預金",
  "普通預金",
  "支払利息",
  "支払手数料",
  "雑収入",
  "受取手形"
];

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < accountTitles.length; i++) {
      const name = accountTitles[i];
      const sortOrder = (i + 1) * 10;

      const result = await client.query(
        `
        INSERT INTO expenses.account_titles
          (account_name, sort_order, is_active)
        VALUES
          ($1, $2, TRUE)
        ON CONFLICT (account_name)
        DO UPDATE SET
          is_active = TRUE,
          sort_order = CASE
            WHEN expenses.account_titles.sort_order IS NULL OR expenses.account_titles.sort_order = 0
            THEN EXCLUDED.sort_order
            ELSE expenses.account_titles.sort_order
          END
        RETURNING
          account_title_id,
          account_name,
          (xmax = 0) AS inserted
        `,
        [name, sortOrder]
      );

      if (result.rows[0].inserted) {
        inserted++;
      } else {
        updated++;
      }
    }

    await client.query("COMMIT");

    console.log("OK: 勘定科目ハンコデータを導入しました。");
    console.log(`追加: ${inserted}`);
    console.log(`既存更新/再有効化: ${updated}`);
    console.log(`対象件数: ${accountTitles.length}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("NG: 導入に失敗しました。");
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
