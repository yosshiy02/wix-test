const migrationService = require("./src/migrations/migration.service");

(async () => {
  const result = await migrationService.applyMigrationFile("20260703_001_baseline_current_schema.sql");
  const status = await migrationService.listMigrationStatus();

  console.log(JSON.stringify({
    ok: true,
    applied_result: result,
    status
  }, null, 2));
})().catch(err => {
  console.error(JSON.stringify({
    ok: false,
    error: err.message,
    stack: err.stack
  }, null, 2));
  process.exit(1);
});
