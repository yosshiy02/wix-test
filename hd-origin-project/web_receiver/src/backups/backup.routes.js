const { sendJson, readBody } = require("../response");
const { listBackups, createBackup, restoreBackup } = require("./backup.service");
const config = require("../config");

async function handleBackupRoutes(req, res) {
  if (req.method === "GET" && req.url === "/api/backup/list") {
    sendJson(res, 200, {
      ok: true,
      backup_dir: config.backupDir,
      backups: listBackups()
    });

    return true;
  }

  if (req.method === "POST" && req.url === "/api/backup/create") {
    const backup = await createBackup(process.env.DB_NAME || "database");

    sendJson(res, 200, {
      ok: true,
      message: "バックアップを作成しました。",
      backup
    });

    return true;
  }

  if (req.method === "POST" && req.url === "/api/backup/restore") {
    const raw = await readBody(req);
    const body = JSON.parse(raw || "{}");

    const result = await restoreBackup(body.file_name);

    sendJson(res, 200, {
      ok: true,
      message: "リストアが完了しました。",
      restored_file: result.restored_file,
      safety_backup: result.safety_backup
    });

    return true;
  }

  return false;
}

module.exports = {
  handleBackupRoutes,
};
