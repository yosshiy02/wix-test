const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");
const http = require("http");
const config = require("./src/config");
const { listBackups, createBackup, restoreBackup } = require("./src/backups/backup.service");
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
/* HD_ORIGIN_EXIT_BACKUP_20260706_END *//* HD_ORIGIN_STARTUP_RESTORE_CHECK_20260706_START */
function hdOriginStartupRestorePcFile() {
  return path.join(config.projectRoot, "HD_ORIGIN_LAST_RESTORE_CHECK_PC.txt");
}
function hdOriginGetCurrentPcName() {
  return String(
    process.env.COMPUTER_NAME ||
    process.env.COMPUTERNAME ||
    os.hostname() ||
    "UNKNOWN_PC"
  ).trim();
}
function hdOriginReadLastRestoreCheckPc() {
  const filePath = hdOriginStartupRestorePcFile();
  try {
    if (!fs.existsSync(filePath)) {
      return "";
    }
    return fs.readFileSync(filePath, "utf8").trim();
  } catch (err) {
    console.error("[STARTUP_RESTORE_CHECK] 前回PC名の読取に失敗:", err.message);
    return "";
  }
}
function hdOriginWriteLastRestoreCheckPc(pcName) {
  const filePath = hdOriginStartupRestorePcFile();
  fs.writeFileSync(filePath, `${pcName}\n`, "utf8");
}
function hdOriginAskStartupRestore(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(question, answer => {
      rl.close();
      resolve(String(answer || "").trim());
    });
  });
}
async function hdOriginMaybeRestoreLatestBackupOnPcChange() {
  const currentPc = hdOriginGetCurrentPcName();
  const lastPc = hdOriginReadLastRestoreCheckPc();
  if (!currentPc) {
    console.log("[STARTUP_RESTORE_CHECK] 現在PC名を取得できないため、リストア確認を省略します。");
    return;
  }
  if (lastPc && lastPc === currentPc) {
    console.log(`[STARTUP_RESTORE_CHECK] 同じPCのため、最新版リストア確認を省略します。PC=${currentPc}`);
    return;
  }
  if (!process.stdin.isTTY) {
    console.log("[STARTUP_RESTORE_CHECK] 対話入力できない起動のため、リストア確認を省略します。");
    return;
  }
  const backups = listBackups();
  const latest = backups.find(backup => !backup.is_safety_backup);
  console.log("");
  console.log("============================================================");
  console.log("HD Origin Project 起動時リストア確認");
  console.log("============================================================");
  console.log(`現在PC: ${currentPc}`);
  console.log(`前回確認PC: ${lastPc || "記録なし"}`);
  console.log("");
  if (!latest) {
    console.log("[STARTUP_RESTORE_CHECK] 通常バックアップが見つかりません。リストア確認を終了します。");
    console.log("[STARTUP_RESTORE_CHECK] バックアップ未検出のため、PC確認記録は更新しません。");
    console.log("");
    return;
  }
  console.log("PCが変わった、または前回PC記録がありません。");
  console.log("最新版の通常バックアップをリストアするか確認します。");
  console.log("");
  console.log(`対象バックアップ: ${latest.file_name}`);
  console.log(`更新日時: ${latest.updated_at}`);
  console.log(`保存先: ${config.backupDir}`);
  console.log("");
  console.log("注意: リストアは現在のDBを上書きします。");
  console.log("注意: 実行前に backup.service.js 側でリストア前保険バックアップを作成します。");
  console.log("");
  const first = await hdOriginAskStartupRestore("リストアする場合だけ RESTORE と入力してください。中止はEnter: ");
  if (first !== "RESTORE") {
    console.log("[STARTUP_RESTORE_CHECK] リストアしません。今回PCは確認済みとして記録します。");
    hdOriginWriteLastRestoreCheckPc(currentPc);
    console.log("");
    return;
  }
  const second = await hdOriginAskStartupRestore("最終確認です。実行する場合だけ RESTORE_NOW と入力してください。中止はEnter: ");
  if (second !== "RESTORE_NOW") {
    console.log("[STARTUP_RESTORE_CHECK] リストアを中止しました。今回PCは確認済みとして記録します。");
    hdOriginWriteLastRestoreCheckPc(currentPc);
    console.log("");
    return;
  }
  console.log("[STARTUP_RESTORE_CHECK] リストアを開始します。");
  console.log(`[STARTUP_RESTORE_CHECK] 対象: ${latest.file_name}`);
  try {
    const result = await restoreBackup(latest.file_name);
    console.log("[STARTUP_RESTORE_CHECK] リストアが完了しました。");
    console.log(`[STARTUP_RESTORE_CHECK] 復元ファイル: ${result.restored_file}`);
    if (result.safety_backup && result.safety_backup.file_name) {
      console.log(`[STARTUP_RESTORE_CHECK] リストア前保険バックアップ: ${result.safety_backup.file_name}`);
    }
    hdOriginWriteLastRestoreCheckPc(currentPc);
    console.log(`[STARTUP_RESTORE_CHECK] 今回PCを記録しました: ${currentPc}`);
  } catch (err) {
    console.error("[STARTUP_RESTORE_CHECK] リストアに失敗しました:", err.message);
    if (err.stderr) {
      console.error(err.stderr);
    }
    console.error("[STARTUP_RESTORE_CHECK] 失敗したため、今回PCは記録しません。");
  }
  console.log("");
}
/* HD_ORIGIN_STARTUP_RESTORE_CHECK_20260706_END */
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












