const pool = require("./src/db");

async function columnExists(client, tableSchema, tableName, columnName) {
  const result = await client.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
      AND column_name = $3
    `,
    [tableSchema, tableName, columnName]
  );

  return result.rowCount > 0;
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const hasAccountCode = await columnExists(
      client,
      "expenses",
      "account_titles",
      "account_code"
    );

    if (!hasAccountCode) {
      await client.query(`
        ALTER TABLE expenses.account_titles
        ADD COLUMN account_code TEXT
      `);

      console.log("OK: account_code フィールドを追加しました。値は入れていません。");
    } else {
      console.log("OK: account_code フィールドは既にあります。");
    }

    await client.query("COMMIT");

    const rows = await client.query(`
      SELECT
        account_title_id,
        account_code,
        account_name,
        sort_order,
        is_active
      FROM expenses.account_titles
      ORDER BY account_title_id
    `);

    console.log("");
    console.log("=== 勘定科目 ID順 一覧 ===");
    console.log("ID\tCODE\tACTIVE\tSORT\tNAME");

    for (const row of rows.rows) {
      console.log([
        row.account_title_id,
        row.account_code || "",
        row.is_active ? "ON" : "OFF",
        row.sort_order ?? "",
        row.account_name
      ].join("\t"));
    }

    console.log("");
    console.log(`件数: ${rows.rowCount}`);

    const idRows = rows.rows.map(r => Number(r.account_title_id)).filter(Number.isFinite);
    const minId = idRows.length ? Math.min(...idRows) : null;
    const maxId = idRows.length ? Math.max(...idRows) : null;

    if (minId !== null && maxId !== null) {
      const existing = new Set(idRows);
      const gaps = [];

      for (let i = minId; i <= maxId; i++) {
        if (!existing.has(i)) gaps.push(i);
      }

      console.log(`ID最小: ${minId}`);
      console.log(`ID最大: ${maxId}`);
      console.log(`ID欠番数: ${gaps.length}`);

      if (gaps.length) {
        console.log(`ID欠番: ${gaps.slice(0, 100).join(", ")}${gaps.length > 100 ? " ..." : ""}`);
      }
    }

    console.log("");
    console.log("注意:");
    console.log("IDはDB内部番号なので、追加・削除・やり直しで欠番が出ます。");
    console.log("帳票や会計上の並びは、IDではなく account_code または sort_order で管理します。");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("NG: 確認に失敗しました。");
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
