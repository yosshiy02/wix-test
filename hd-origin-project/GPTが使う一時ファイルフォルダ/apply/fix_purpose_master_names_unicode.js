const fs = require("fs");
const path = require("path");
const pool = require("../../web_receiver/src/db");

// ????PowerShell???????????Unicode???????????
// sort_order?????????????????
const purposes = [
  { sort_order: 10,  name: "\u4f1a\u8b70" },                         // ??
  { sort_order: 20,  name: "\u5546\u8ac7" },                         // ??
  { sort_order: 30,  name: "\u51fa\u5f35\u5148\u4f1a\u8b70" },       // ?????
  { sort_order: 40,  name: "\u51fa\u5f35" },                         // ??
  { sort_order: 50,  name: "\u6765\u5ba2\u5bfe\u5fdc" },             // ????
  { sort_order: 60,  name: "\u53d6\u5f15\u5148\u8a2a\u554f" },       // ?????
  { sort_order: 70,  name: "\u4ed5\u5165\u5148\u8a2a\u554f" },       // ?????
  { sort_order: 80,  name: "\u793e\u5185\u4f1a\u8b70" },             // ????
  { sort_order: 90,  name: "\u793e\u5185\u6253\u5408\u305b" },       // ?????
  { sort_order: 100, name: "\u6253\u5408\u305b" },                   // ???
  { sort_order: 110, name: "\u63a5\u5f85" },                         // ??
  { sort_order: 120, name: "\u798f\u5229\u539a\u751f" },             // ????
  { sort_order: 130, name: "\u55b6\u696d\u6d3b\u52d5" },             // ????
  { sort_order: 140, name: "\u5e02\u5834\u8abf\u67fb" },             // ????
  { sort_order: 150, name: "\u5546\u54c1\u78ba\u8a8d" },             // ????
  { sort_order: 160, name: "\u30b5\u30f3\u30d7\u30eb\u78ba\u8a8d" }, // ??????
  { sort_order: 170, name: "\u7d0d\u671f\u78ba\u8a8d" },             // ????
  { sort_order: 180, name: "\u4ed5\u69d8\u78ba\u8a8d" },             // ????
  { sort_order: 190, name: "\u8ca9\u8def\u958b\u62d3" },             // ????
  { sort_order: 200, name: "\u30a4\u30d9\u30f3\u30c8\u6e96\u5099" }, // ??????
  { sort_order: 210, name: "\u5c55\u793a\u8ca9\u58f2" },             // ????
  { sort_order: 220, name: "\u30b7\u30b9\u30c6\u30e0\u958b\u767a" }, // ??????
  { sort_order: 230, name: "\u5099\u54c1\u8cfc\u5165" },             // ????
  { sort_order: 240, name: "\u6d88\u8017\u54c1\u8cfc\u5165" },       // ?????
  { sort_order: 250, name: "\u4fee\u7406\u5bfe\u5fdc" },             // ????
  { sort_order: 260, name: "\u5b98\u516c\u5e81\u624b\u7d9a" },       // ?????
  { sort_order: 270, name: "\u7a0e\u52d9\u30fb\u4f1a\u8a08\u76f8\u8ac7" }, // ???????
  { sort_order: 280, name: "\u9280\u884c\u624b\u7d9a" },             // ????
  { sort_order: 290, name: "\u4ea4\u901a\u79fb\u52d5" },             // ????
  { sort_order: 300, name: "\u5bbf\u6cca" },                         // ??
  { sort_order: 310, name: "\u901a\u4fe1\u30fb\u90f5\u9001" },       // ?????
  { sort_order: 320, name: "\u305d\u306e\u4ed6\u696d\u52d9" },       // ?????
  { sort_order: 330, name: "\u8981\u78ba\u8a8d" },                   // ???
  { sort_order: 340, name: "\u5bfe\u8c61\u5916" },                   // ???
  { sort_order: 350, name: "\u79c1\u7528" }                          // ??
];

(async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ?????????????
    await client.query(`
      UPDATE expenses.purposes
      SET is_active = FALSE
      WHERE purpose_name IN (
        '\u51fa\u5f35\u5148\u6253\u5408\u305b'
      )
    `);

    const rows = [];

    for (const item of purposes) {
      // sort_order????????????????????????
      const found = await client.query(
        `
        SELECT purpose_id
        FROM expenses.purposes
        WHERE sort_order = $1
        ORDER BY purpose_id
        LIMIT 1
        `,
        [item.sort_order]
      );

      let row;

      if (found.rows.length > 0) {
        const id = found.rows[0].purpose_id;

        const updated = await client.query(
          `
          UPDATE expenses.purposes
          SET
            purpose_name = $1,
            is_active = TRUE
          WHERE purpose_id = $2
          RETURNING purpose_id, purpose_name, sort_order, is_active
          `,
          [item.name, id]
        );

        row = updated.rows[0];
      } else {
        const inserted = await client.query(
          `
          INSERT INTO expenses.purposes (
            purpose_name,
            sort_order,
            is_active
          )
          VALUES ($1, $2, TRUE)
          RETURNING purpose_id, purpose_name, sort_order, is_active
          `,
          [item.name, item.sort_order]
        );

        row = inserted.rows[0];
      }

      rows.push(row);
    }

    await client.query("COMMIT");

    const active = await pool.query(`
      SELECT purpose_id, purpose_name, sort_order, is_active
      FROM expenses.purposes
      WHERE is_active = TRUE
      ORDER BY sort_order, purpose_id
    `);

    const lines = [];
    lines.push("==============================");
    lines.push("????? ????????");
    lines.push("==============================");
    lines.push("OK: Unicode????????????????????");
    lines.push("");
    lines.push("[????????]");
    for (const row of active.rows) {
      lines.push(`${row.sort_order}: ${row.purpose_id} ${row.purpose_name}`);
    }

    const outPath = path.resolve(
      __dirname,
      "../memo/00_?????_??????_node??.txt"
    );

    fs.writeFileSync(outPath, lines.join("\n"), "utf8");

    console.log(lines.join("\n"));
    console.log("");
    console.log("result file:", outPath);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
