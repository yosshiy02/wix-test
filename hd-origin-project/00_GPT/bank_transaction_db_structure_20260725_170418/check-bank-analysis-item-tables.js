"use strict";

const pool = require("./src/db");

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN READ ONLY");

    const result = await client.query(`
      SELECT
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable
      FROM information_schema.columns c
      WHERE c.table_schema NOT IN (
        'pg_catalog',
        'information_schema'
      )
        AND (
          c.table_name ILIKE '%specialist%analysis%'
          OR c.table_name ILIKE '%analysis%item%'
          OR c.column_name IN (
            'specialist_analysis_code',
            'specialist_analysis_id',
            'analysis_item_code',
            'analysis_item_id'
          )
        )
      ORDER BY
        c.table_schema,
        c.table_name,
        c.ordinal_position
    `);

    const tables = new Map();

    for (const row of result.rows) {
      const tableName =
        row.table_schema + "." + row.table_name;

      if (!tables.has(tableName)) {
        tables.set(tableName, []);
      }

      tables.get(tableName).push(row);
    }

    console.log(
      "CANDIDATE_TABLE_COUNT=" +
      tables.size
    );

    for (const [tableName, columns] of tables) {
      console.log(
        "------------------------------------------------------------"
      );
      console.log("TABLE=" + tableName);
      console.log("COLUMN_COUNT=" + columns.length);

      for (const column of columns) {
        console.log(
          "COLUMN=" +
          column.column_name +
          " TYPE=" +
          column.data_type +
          " NULLABLE=" +
          column.is_nullable
        );
      }
    }

    await client.query("ROLLBACK");
  }
  catch (error) {
    try {
      await client.query("ROLLBACK");
    }
    catch (rollbackError) {
      console.error(
        "ROLLBACK_ERROR=" +
        rollbackError.message
      );
    }

    throw error;
  }
  finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(
    "NODE_ERROR=" +
    (
      error && error.stack
        ? error.stack
        : String(error)
    )
  );

  process.exitCode = 1;
});