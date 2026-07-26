const db = require("../web_receiver/src/db");

const targets = [
  "payment_document_contract_insurance_lease_drafts",
  "payment_document_contract_insurance_lease_item_lines",
  "payment_document_contract_insurance_lease_results"
];

async function main() {
  const client = await db.connect();

  try {
    await client.query("BEGIN READ ONLY");

    console.log("CONNECTION_MODE=READ_ONLY");
    console.log("TARGET_SCHEMA=accounting");
    console.log("");

    for (const tableName of targets) {
      const existsResult = await client.query(
        `
        SELECT to_regclass($1) IS NOT NULL AS exists
        `,
        [`accounting.${tableName}`]
      );

      const exists = existsResult.rows[0].exists === true;

      console.log(`TABLE=accounting.${tableName}`);
      console.log(`EXISTS=${exists ? "YES" : "NO"}`);

      if (exists) {
        const countResult = await client.query(
          `SELECT COUNT(*)::bigint AS row_count
           FROM accounting.${tableName}`
        );

        console.log(`ROW_COUNT=${countResult.rows[0].row_count}`);
      } else {
        console.log("ROW_COUNT=NOT_APPLICABLE");
      }

      console.log("");
    }

    const fkResult = await client.query(
      `
      SELECT
        con.conname AS constraint_name,
        src_ns.nspname AS source_schema,
        src.relname AS source_table,
        tgt_ns.nspname AS target_schema,
        tgt.relname AS target_table,
        pg_get_constraintdef(con.oid, true) AS definition
      FROM pg_constraint con
      JOIN pg_class src
        ON src.oid = con.conrelid
      JOIN pg_namespace src_ns
        ON src_ns.oid = src.relnamespace
      JOIN pg_class tgt
        ON tgt.oid = con.confrelid
      JOIN pg_namespace tgt_ns
        ON tgt_ns.oid = tgt.relnamespace
      WHERE con.contype = 'f'
        AND (
          (
            src_ns.nspname = 'accounting'
            AND src.relname = ANY($1::text[])
          )
          OR
          (
            tgt_ns.nspname = 'accounting'
            AND tgt.relname = ANY($1::text[])
          )
        )
      ORDER BY
        src_ns.nspname,
        src.relname,
        con.conname
      `,
      [targets]
    );

    console.log("FOREIGN_KEY_DEPENDENCY_COUNT=" + fkResult.rowCount);

    for (const row of fkResult.rows) {
      console.log(
        [
          `CONSTRAINT=${row.constraint_name}`,
          `SOURCE=${row.source_schema}.${row.source_table}`,
          `TARGET=${row.target_schema}.${row.target_table}`,
          `DEFINITION=${row.definition}`
        ].join(" | ")
      );
    }

    await client.query("ROLLBACK");

    console.log("");
    console.log("DATABASE_READ=YES");
    console.log("DATABASE_UPDATE=NO");
    console.log("DATABASE_COMMIT=NO");
    console.log("OVERALL_STATUS=SUCCESS");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
    }

    console.log("");
    console.log("DATABASE_INSPECTION_ERROR");
    console.log(`ERROR_TYPE=${error && error.name ? error.name : "Error"}`);
    console.log(
      `ERROR_CODE=${error && error.code ? error.code : ""}`
    );
    console.log(
      `ERROR_MESSAGE=${error && error.message ? error.message : String(error)}`
    );
    console.log("DATABASE_UPDATE=NO");
    console.log("DATABASE_COMMIT=NO");
    console.log("OVERALL_STATUS=FAILED");

    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
}

main().catch(async error => {
  console.log(`UNHANDLED_ERROR=${error.message}`);
  console.log("OVERALL_STATUS=FAILED");

  try {
    await db.end();
  } catch (_) {
  }

  process.exitCode = 1;
});