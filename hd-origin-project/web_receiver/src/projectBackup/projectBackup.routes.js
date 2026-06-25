const { sendJson } = require("../response");
const { listProjectBackups, createProjectBackup } = require("./projectBackup.service");
const path = require("path");
const config = require("../config");

async function handleProjectBackupRoutes(req, res) {
  if (req.method === "GET" && req.url === "/api/project-backup/list") {
    sendJson(res, 200, {
      ok: true,
      backup_dir: path.join(config.backupDir, "project"),
      backups: listProjectBackups()
    });

    return true;
  }

  if (req.method === "POST" && req.url === "/api/project-backup/create") {
    const backup = await createProjectBackup();

    sendJson(res, 200, {
      ok: true,
      message: "プログラム本体バックアップを作成しました。",
      backup
    });

    return true;
  }

  return false;
}

module.exports = {
  handleProjectBackupRoutes,
};
