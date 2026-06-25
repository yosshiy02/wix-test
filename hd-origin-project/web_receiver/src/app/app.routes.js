const { sendJson, readBody } = require("../response");
const { createBackup } = require("../backups/backup.service");

function makeAppRoutes(server) {
  return async function handleAppRoutes(req, res) {
    if (req.method === "POST" && req.url === "/api/app/exit") {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      let backup = null;

      if (body.backup === true) {
        backup = await createBackup(process.env.DB_NAME || "database");
      }

      sendJson(res, 200, {
        ok: true,
        message: body.backup === true
          ? "バックアップ作成後、アプリを終了します。"
          : "アプリを終了します。",
        backup
      });

      setTimeout(() => {
        server.close(() => {
          process.exit(0);
        });

        setTimeout(() => process.exit(0), 1500);
      }, 500);

      return true;
    }

    return false;
  };
}

module.exports = {
  makeAppRoutes,
};
