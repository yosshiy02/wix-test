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
  const result = await pool.query(
    `
    UPDATE expenses.purposes
    SET is_active = FALSE
    WHERE purpose_name = ANY($1::text[])
    RETURNING purpose_id, purpose_name, is_active
    `,
    [purposes]
  );

  console.log("UNDO: 目的マスタを無効化しました。");
  console.table(result.rows);

  await pool.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
