const pool = require("../../web_receiver/src/db");

const purposes = [
  "打合せ",
  "商談",
  "会議",
  "出張",
  "出張先打合せ",
  "来客対応",
  "取引先訪問",
  "仕入先訪問",
  "社内打合せ",
  "接待",
  "福利厚生",
  "営業活動",
  "市場調査",
  "商品確認",
  "サンプル確認",
  "納期確認",
  "仕様確認",
  "販路開拓",
  "イベント準備",
  "展示販売",
  "システム開発",
  "備品購入",
  "消耗品購入",
  "修理対応",
  "官公庁手続",
  "税務・会計相談",
  "銀行手続",
  "交通移動",
  "宿泊",
  "通信・郵送",
  "その他業務",
  "要確認",
  "対象外",
  "私用"
];

(async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const before = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM expenses.purposes
    `);

    const results = [];

    for (let i = 0; i < purposes.length; i++) {
      const name = purposes[i];
      const sortOrder = (i + 1) * 10;

      const r = await client.query(
        `
        INSERT INTO expenses.purposes (
          purpose_name,
          sort_order,
          is_active
        )
        VALUES ($1, $2, TRUE)
        ON CONFLICT (purpose_name)
        DO UPDATE SET
          sort_order = EXCLUDED.sort_order,
          is_active = TRUE
        RETURNING
          purpose_id,
          purpose_name,
          sort_order,
          is_active
        `,
        [name, sortOrder]
      );

      results.push(r.rows[0]);
    }

    const after = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM expenses.purposes
    `);

    await client.query("COMMIT");

    console.log("==============================");
    console.log("目的マスタ 34件追加結果");
    console.log("==============================");
    console.log("追加・更新対象:", purposes.length);
    console.log("追加前件数:", before.rows[0].count);
    console.log("追加後件数:", after.rows[0].count);
    console.log("");
    console.table(results.map((row) => ({
      id: row.purpose_id,
      name: row.purpose_name,
      sort_order: row.sort_order,
      active: row.is_active
    })));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
