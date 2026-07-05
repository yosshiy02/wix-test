const http = require("http");
const { spawn } = require("child_process");
const config = require("./src/config");
const { sendJson } = require("./src/response");
const { serveStatic } = require("./src/static");
const { writeProjectStatus } = require("./src/projectStatus");
const { ensureDatabaseReady } = require("./src/db.bootstrap");

const { handleItemsRoutes } = require("./src/items/items.routes");
const { handleBackupRoutes } = require("./src/backups/backup.routes");
const { handleProjectBackupRoutes } = require("./src/projectBackup/projectBackup.routes");
const { handleExpenseRoutes } = require("./src/expenses/expenses.routes");
const { handleReceiptRoutes } = require("./src/receipts/receipts.routes");
const { handleMasterRoutes } = require("./src/masters/masters.routes");
const { makeAppRoutes } = require("./src/app/app.routes");

let handleAppRoutes;

function handleSystemRestartRoute(req, res) {
  if (req.method !== "POST" || !req.url.startsWith("/api/system/restart")) {
    return false;
  }

  const path = require("path");
  const restartBat = path.join(config.projectRoot, "restart_hd_origin.bat");

  sendJson(res, 200, {
    ok: true,
    message: "HD Origin Project server restart requested."
  });

  setTimeout(() => {
    const child = spawn("cmd.exe", ["/c", "start", "", restartBat, String(process.pid)], {
      detached: true,
      stdio: "ignore",
      windowsHide: false
    });

    child.unref();

    server.close(() => {
      process.exit(0);
    });

    setTimeout(() => {
      process.exit(0);
    }, 1500);
  }, 300);

  return true;
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      if (await handleMasterRoutes(req, res)) return;
      if (await handleItemsRoutes(req, res)) return;
      if (await handleBackupRoutes(req, res)) return;
      if (await handleProjectBackupRoutes(req, res)) return;
      if (await handleExpenseRoutes(req, res)) return;
      if (await handleReceiptRoutes(req, res)) return;
      if (await handleAppRoutes(req, res)) return;

      return sendJson(res, 404, { ok: false, error: "API not found" });
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

async function start() {
  writeProjectStatus();
  await ensureDatabaseReady();



  server.listen(config.PORT, () => {
    console.log(`HD Origin Project running: http://localhost:${config.PORT}`);
  });
}

start().catch(err => {
  console.error("[起動失敗]", err);
  process.exit(1);
});





