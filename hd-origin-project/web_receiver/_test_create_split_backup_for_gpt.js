const backupService = require("./src/backups/backup.service");

(async () => {
  const result = await backupService.createBackup(process.env.DB_NAME || "hd_origin_project");

  console.log(JSON.stringify({
    ok: true,
    file_name: result.file_name,
    full_path: result.full_path,
    backup_format: result.backup_format,
    backup_artifacts: result.backup_artifacts,
    migration_version: result.migration_version,
    clone_backup: result.clone_backup,
    cleanup: result.cleanup
  }, null, 2));
})().catch(err => {
  console.error(JSON.stringify({
    ok: false,
    error: err.message,
    stack: err.stack
  }, null, 2));
  process.exit(1);
});
