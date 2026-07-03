const pool = require(process.argv[2]);

async function main() {
  const version = "20260703_001_baseline_current_schema";
  const memo = "Current DB schema registered as baseline";

  await pool.query(
    `
      UPDATE system.schema_migrations
      SET memo = $1
      WHERE version = $2
    `,
    [memo, version]
  );

  const result = await pool.query(
    `
      SELECT version, name, file_name, applied_at, applied_by, memo
      FROM system.schema_migrations
      WHERE version = $1
    `,
    [version]
  );

  console.log(JSON.stringify({
    ok: true,
    updated: result.rows
  }, null, 2));
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
