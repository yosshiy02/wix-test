const http = require("http");
const config = require("./src/config");
const { sendJson } = require("./src/response");
const { serveStatic } = require("./src/static");

const { handleItemsRoutes } = require("./src/items/items.routes");
const { handleBackupRoutes } = require("./src/backups/backup.routes");
const { handleProjectBackupRoutes } = require("./src/projectBackup/projectBackup.routes");
const { handleExpenseRoutes } = require("./src/expenses/expenses.routes");
const { makeAppRoutes } = require("./src/app/app.routes");

let handleAppRoutes;

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      if (await handleItemsRoutes(req, res)) return;
      if (await handleBackupRoutes(req, res)) return;
      if (await handleProjectBackupRoutes(req, res)) return;
      if (await handleExpenseRoutes(req, res)) return;
      if (await handleAppRoutes(req, res)) return;

      return sendJson(res, 404, {
        ok: false,
        error: "API not found"
      });
    }

    serveStatic(req, res);
  } catch (err) {
    console.error(err);

    sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.message,
      stderr: err.stderr || undefined
    });
  }
});

handleAppRoutes = makeAppRoutes(server);

server.listen(config.PORT, () => {
  console.log(`HD Origin Project running: http://localhost:${config.PORT}`);
});

