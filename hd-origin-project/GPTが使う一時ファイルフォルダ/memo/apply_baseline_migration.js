const fs = require("fs");
const crypto = require("crypto");

const baselineSqlPath = process.argv[2];
const dbJsPath = process.argv[3];

const pool = require(dbJsPath);

function checksumSha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

async function main() {
  const sql = fs.readFileSync(baselineSqlPath, "utf8");
  const checksum = checksumSha256(sql);

  const version = "20260703_001_baseline_current_schema";
  const name = "baseline_current_schema";
  const fileName = "20260703_001_baseline_current_schema.sql";

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(sql);

    const exists = await client.query(
      "SELECT version FROM system.schema_migrations WHERE version = $1",
      [version]
    );

    if (exists.rows.length === 0) {
      await client.query(
        `
          INSERT INTO system.schema_migrations
            (version, name, file_name, checksum_sha256, memo)
          VALUES
            ($1, $2, $3, $4, $5)
        `,
        [
          version,
          name,
          fileName,
          checksum,
          "現在のDB構造をbaselineとして登録"
        ]
      );
    }

    await client.query("COMMIT");

    const status = await pool.query(`
      SELECT version, name, file_name, applied_at, applied_by, memo
      FROM system.schema_migrations
      ORDER BY version
    `);

    console.log(JSON.stringify({
      ok: true,
      applied_or_already_exists: version,
      migrations: status.rows
    }, null, 2));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
