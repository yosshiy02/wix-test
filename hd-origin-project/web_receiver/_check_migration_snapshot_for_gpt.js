const migrationService = require("./src/migrations/migration.service");

(async () => {
  const status = await migrationService.listMigrationStatus();

  console.log(JSON.stringify({
    ok: true,
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
