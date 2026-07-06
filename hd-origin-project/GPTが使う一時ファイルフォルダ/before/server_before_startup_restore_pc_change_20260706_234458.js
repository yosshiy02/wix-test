const http = require("http");
const config = require("./src/config");
const { createBackup } = require("./src/backups/backup.service");
const { sendJson } = require("./src/response");
const { serveStatic } = require("./src/static");
const { writeProjectStatus } = require("./src/projectStatus");
const { ensureDatabaseReady } = require("./src/db.bootstrap");

const { handleItemsRoutes } = require("./src/items/items.routes");
const { handleBackupRoutes } = require("./src/backups/backup.routes");
const { handleProjectBackupRoutes } = require("./src/projectBackup/projectBackup.routes");
const { handleExpenseRoutes } = require("./src/expenses/expenses.routes");
/* PAYABLES_ROUTE_REQUIRE_20260706_START */
const { handlePayableRoutes } = require("./src/payables/payables.routes");
/* PAYABLES_ROUTE_REQUIRE_20260706_END */
const { handleReceiptRoutes } = require("./src/receipts/receipts.routes");
const { handleMasterRoutes } = require("./src/masters/masters.routes");
const { makeAppRoutes } = require("./src/app/app.routes");

let handleAppRoutes;

/* HD_ORIGIN_EXIT_BACKUP_20260706_START */
let hdOriginSystemExitInProgress = false;
function hdOriginSafeExitReason(reason) {
  return String(reason || "exit").replace(/[^a-zA-Z0-9_]+/g, "_").slice(0, 40) || "exit";
}
async function hdOriginCreateExitBackup(reason) {
  const dbName = process.env.DB_NAME || "database";
  const safeReason = hdOriginSafeExitReason(reason);
  return await createBackup(`${dbName}_before_${safeReason}`);
}
function hdOriginExitLater(code) {
  setTimeout(() => {
    process.exit(code);
  }, 500);
}
async function hdOriginRunBackupThenExit(res, reason, exitCode) {
  if (hdOriginSystemExitInProgress) {
    sendJson(res, 409, {
      ok: false,
      error: "終了または再起動処理が既に実行中です。"
    });
    return;
  }
  hdOriginSystemExitInProgress = true;
  try {
    const backup = await hdOriginCreateExitBackup(reason);
    sendJson(res, 200, {
      ok: true,
      message: "終了または再起動前のDBバックアップを作成しました。",
      action: reason,
      backup
    });
    hdOriginExitLater(exitCode);
  } catch (err) {
    hdOriginSystemExitInProgress = false;
    sendJson(res, 500, {
      ok: false,
      error: "終了または再起動前バックアップに失敗しました。",
      detail: err.message,
      stderr: err.stderr || undefined
    });
  }
}
function handleSystemRestartRoute(req, res) {
  if (req.method !== "POST") {
    return false;
  }
  const urlPath = String(req.url || "").split("?")[0];
  if (
    urlPath === "/api/system/restart" ||
    urlPath === "/api/system/restart-with-backup"
  ) {
    hdOriginRunBackupThenExit(res, "restart", 100);
    return true;
  }
  if (
    urlPath === "/api/system/shutdown" ||
    urlPath === "/api/system/shutdown-with-backup" ||
    urlPath === "/api/system/exit"
  ) {
    hdOriginRunBackupThenExit(res, "shutdown", 0);
    return true;
  }
  return false;
}
async function hdOriginBackupBeforeSignal(signal) {
  if (hdOriginSystemExitInProgress) {
    return;
  }
  hdOriginSystemExitInProgress = true;
  try {
    console.log(`[SYSTEM_EXIT_BACKUP] ${signal}: DBバックアップ開始`);
    const backup = await hdOriginCreateExitBackup(String(signal || "signal").toLowerCase());
    console.log("[SYSTEM_EXIT_BACKUP] DBバックアップ完了:", backup.file_name || "");
  } catch (err) {
    console.error("[SYSTEM_EXIT_BACKUP] DBバックアップ失敗:", err.message);
  } finally {
    process.exit(0);
  }
}
process.once("SIGINT", () => {
  hdOriginBackupBeforeSignal("SIGINT");
});
process.once("SIGTERM", () => {
  hdOriginBackupBeforeSignal("SIGTERM");
});
/* HD_ORIGIN_EXIT_BACKUP_20260706_END */
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      if (handleSystemRestartRoute(req, res)) return;
      if (await handleMasterRoutes(req, res)) return;
      if (await handleItemsRoutes(req, res)) return;
      if (await handleBackupRoutes(req, res)) return;
      if (await handleProjectBackupRoutes(req, res)) return;
      if (await handleExpenseRoutes(req, res)) return;
      /* PAYABLES_ROUTE_HANDLER_20260706_START */
      if (await handlePayableRoutes(req, res)) return;
      /* PAYABLES_ROUTE_HANDLER_20260706_END */
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











