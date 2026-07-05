const fs = require("fs");
const path = require("path");
const pool = require("../../web_receiver/src/db");

const resultPath = path.resolve(
  __dirname,
  "../memo/00_?????_??????_node??_v3.txt"
);

// ????PowerShell???????????Unicode?????????
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
  const lines = [];

  try {
    await client.query("BEGIN");

    lines.push("==============================");
    lines.push("????? ???????? v3");
    lines.push("==============================");

    const desiredNames = purposes.map((x) => x.name);

    // ??? sort_order 10-350????????????????????????
    // ??????????? unique ??????????
    const targetRowsResult = await client.query(
      `
      SELECT purpose_id, purpose_name, sort_order, is_active
      FROM expenses.purposes
      WHERE
        sort_order BETWEEN 10 AND 350
        OR purpose_name = ANY($1::text[])
        OR purpose_name LIKE '__PURPOSE_FIX_TEMP_%'
      ORDER BY purpose_id
      `,
      [desiredNames]
    );

    const targetRows = targetRowsResult.rows;

    lines.push("");
    lines.push("[??????]");
    lines.push(String(targetRows.length));

    for (const row of targetRows) {
      await client.query(
        `
        UPDATE expenses.purposes
        SET
          purpose_name = $1,
          is_active = FALSE
        WHERE purpose_id = $2
        `,
        [`__PURPOSE_FIX_TEMP_${row.purpose_id}__`, row.purpose_id]
      );
    }

    const usedIds = new Set();
    const fixedRows = [];

    for (const item of purposes) {
      let candidate = null;

      candidate = targetRows
        .filter((row) => !usedIds.has(row.purpose_id))
        .filter((row) => row.purpose_name === item.name)
        .sort((a, b) => a.purpose_id - b.purpose_id)[0];

      if (!candidate) {
        candidate = targetRows
          .filter((row) => !usedIds.has(row.purpose_id))
          .filter((row) => Number(row.sort_order) === Number(item.sort_order))
          .sort((a, b) => a.purpose_id - b.purpose_id)[0];
      }

      if (!candidate) {
        candidate = targetRows
          .filter((row) => !usedIds.has(row.purpose_id))
          .sort((a, b) => a.purpose_id - b.purpose_id)[0];
      }

      if (candidate) {
        usedIds.add(candidate.purpose_id);

        const updated = await client.query(
          `
          UPDATE expenses.purposes
          SET
            purpose_name = $1,
            sort_order = $2,
            is_active = TRUE
          WHERE purpose_id = $3
          RETURNING purpose_id, purpose_name, sort_order, is_active
          `,
          [item.name, item.sort_order, candidate.purpose_id]
        );

        fixedRows.push(updated.rows[0]);
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

        fixedRows.push(inserted.rows[0]);
      }
    }

    const remainingTemp = await client.query(`
      SELECT purpose_id, purpose_name, sort_order, is_active
      FROM expenses.purposes
      WHERE purpose_name LIKE '__PURPOSE_FIX_TEMP_%'
      ORDER BY purpose_id
    `);

    await client.query("COMMIT");

    const active = await pool.query(`
      SELECT purpose_id, purpose_name, sort_order, is_active
      FROM expenses.purposes
      WHERE is_active = TRUE
      ORDER BY sort_order, purpose_id
    `);

    lines.push("");
    lines.push("[??? ????????]");
    for (const row of active.rows) {
      lines.push(`${row.sort_order}: ${row.purpose_id} ${row.purpose_name}`);
    }

    lines.push("");
    lines.push("[???????????]");
    if (remainingTemp.rows.length === 0) {
      lines.push("??");
    } else {
      for (const row of remainingTemp.rows) {
        lines.push(`${row.purpose_id}: ${row.purpose_name}`);
      }
    }

    lines.push("");
    lines.push("OK: ?????????????");
    lines.push("??????: ??");

    fs.writeFileSync(resultPath, lines.join("\n"), "utf8");

    console.log("OK");
    console.log("result file:", resultPath);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    lines.push("");
    lines.push("NG: ?????????????");
    lines.push(String(error && error.stack ? error.stack : error));
    fs.writeFileSync(resultPath, lines.join("\n"), "utf8");
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
