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
/* PAYMENT_DOCUMENT_ROUTE_REQUIRE_20260707_START */
const { handlePaymentDocumentRoutes } = require("./src/paymentDocuments/paymentDocuments.routes");
/* PAYMENT_DOCUMENT_ROUTE_REQUIRE_20260707_END */
/* DELIVERY_NOTE_ROUTE_REQUIRE_20260707_START */
const { handleDeliveryNoteRoutes } = require("./src/deliveryNotes/deliveryNotes.routes");
/* DELIVERY_NOTE_ROUTE_REQUIRE_20260707_END */
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
function hdOriginGetCurrentPcName() {
  return String(
    process.env.COMPUTER_NAME ||
    process.env.COMPUTERNAME ||
    os.hostname() ||
    "UNKNOWN_PC"
  ).trim();
}

function hdOriginFormatStartupBackupDate(value) {
  try {
    if (!value) return "";
    return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  } catch {
    return String(value || "");
  }
}

function hdOriginShowWindowsMessageBox(title, message, buttons = "OK", icon = "Information") {
  return new Promise(resolve => {
    if (process.platform !== "win32") {
      console.log("[STARTUP_RESTORE_CHECK] Windows以外のため、確認画面を表示せず処理を省略します。");
      resolve("No");
      return;
    }

    const { spawn } = require("child_process");

    const payload = {
      title: String(title || ""),
      message: String(message || ""),
      buttons: String(buttons || "OK"),
      icon: String(icon || "Information")
    };

    const payloadBase64 = Buffer
      .from(JSON.stringify(payload), "utf8")
      .toString("base64");

    const script = `
Add-Type -AssemblyName System.Windows.Forms

$payloadJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${payloadBase64}"))
$payload = $payloadJson | ConvertFrom-Json

$title = [string]$payload.title
$message = [string]$payload.message
$buttons = [System.Enum]::Parse([System.Windows.Forms.MessageBoxButtons], [string]$payload.buttons)
$icon = [System.Enum]::Parse([System.Windows.Forms.MessageBoxIcon], [string]$payload.icon)

$result = [System.Windows.Forms.MessageBox]::Show($message, $title, $buttons, $icon)
[Console]::Out.WriteLine($result.ToString())
`;

    const encodedCommand = Buffer
      .from(script, "utf16le")
      .toString("base64");

    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-STA",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      encodedCommand
    ], {
      windowsHide: false
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", chunk => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", chunk => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", err => {
      console.error("[STARTUP_RESTORE_CHECK] 確認画面の表示に失敗:", err.message);
      resolve("No");
    });

    child.on("close", code => {
      if (code !== 0) {
        console.error("[STARTUP_RESTORE_CHECK] 確認画面が正常終了しませんでした。", stderr.trim());
        resolve("No");
        return;
      }

      const result = String(stdout || "")
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .pop() || "No";

      resolve(result);
    });
  });
}
async function hdOriginConfirmRestoreLatestBackupAfterStartup() {
  const currentPc = hdOriginGetCurrentPcName();
  const backups = listBackups();
  const latest = backups.find(backup => !backup.is_safety_backup);

  if (!latest) {
    console.log("[STARTUP_RESTORE_CHECK] 通常バックアップが見つかりません。このまま使用できます。");
    return false;
  }

  console.log("");
  console.log("============================================================");
  console.log("HD Origin Project 最新バックアップ確認");
  console.log("============================================================");
  console.log(`現在PC: ${currentPc || "UNKNOWN_PC"}`);
  console.log(`最新バックアップ: ${latest.file_name}`);
  console.log(`更新日時: ${hdOriginFormatStartupBackupDate(latest.updated_at)}`);
  console.log(`バックアップ保存先: ${config.backupDir}`);
  console.log("");

  const firstMessage = [
    "本体が起動しました。",
    "",
    "最新のバックアップをリストアしますか？",
    "",
    `対象バックアップ: ${latest.file_name}`,
    `更新日時: ${hdOriginFormatStartupBackupDate(latest.updated_at)}`,
    "",
    "リストアすると、現在のDBはバックアップ内容で上書きされます。",
    "「はい」を押した場合だけ、次に最終確認を出します。"
  ].join("\n");

  const first = await hdOriginShowWindowsMessageBox(
    "HD Origin Project 最新バックアップ確認",
    firstMessage,
    "YesNo",
    "Question"
  );

  if (first !== "Yes") {
    console.log("[STARTUP_RESTORE_CHECK] 最新バックアップのリストアは選択されませんでした。このまま使用できます。");
    return false;
  }

  const secondMessage = [
    "本当にリストアしますか？",
    "",
    `対象バックアップ: ${latest.file_name}`,
    "",
    "現在のDBはバックアップ内容で上書きされます。",
    "実行前にリストア前保険バックアップを自動作成します。",
    "",
    "実行する場合だけ「はい」を押してください。"
  ].join("\n");

  const second = await hdOriginShowWindowsMessageBox(
    "HD Origin Project 最終確認",
    secondMessage,
    "YesNo",
    "Warning"
  );

  if (second !== "Yes") {
    console.log("[STARTUP_RESTORE_CHECK] 最終確認でリストアを中止しました。このまま使用できます。");
    return false;
  }

  console.log("[STARTUP_RESTORE_CHECK] 最新バックアップからリストアを開始します。");
  console.log(`[STARTUP_RESTORE_CHECK] 対象: ${latest.file_name}`);

  try {
    const result = await restoreBackup(latest.file_name);

    console.log("[STARTUP_RESTORE_CHECK] リストアが完了しました。");
    console.log(`[STARTUP_RESTORE_CHECK] 復元ファイル: ${result.restored_file}`);

    if (result.safety_backup && result.safety_backup.file_name) {
      console.log(`[STARTUP_RESTORE_CHECK] リストア前保険バックアップ: ${result.safety_backup.file_name}`);
    }

    await ensureDatabaseReady();

    await hdOriginShowWindowsMessageBox(
      "HD Origin Project リストア完了",
      "最新バックアップからのリストアが完了しました。\nこのまま使用できます。",
      "OK",
      "Information"
    );

    return true;
  } catch (err) {
    console.error("[STARTUP_RESTORE_CHECK] リストアに失敗しました:", err.message);

    if (err.stderr) {
      console.error(err.stderr);
    }

    await hdOriginShowWindowsMessageBox(
      "HD Origin Project リストア失敗",
      `リストアに失敗しました。\n\n${err.message}\n\nDB状態を確認してください。`,
      "OK",
      "Error"
    );

    return false;
  }
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
      /* PAYMENT_DOCUMENT_ROUTE_HANDLER_20260707_START */
      if (await handlePaymentDocumentRoutes(req, res)) return;
      /* PAYMENT_DOCUMENT_ROUTE_HANDLER_20260707_END */
      /* PAYABLES_ROUTE_HANDLER_20260706_START */
      if (await handlePayableRoutes(req, res)) return;
      /* PAYABLES_ROUTE_HANDLER_20260706_END */
      /* DELIVERY_NOTE_ROUTE_HANDLER_20260707_START */
      if (await handleDeliveryNoteRoutes(req, res)) return;
      /* DELIVERY_NOTE_ROUTE_HANDLER_20260707_END */
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
    setTimeout(() => {
      hdOriginConfirmRestoreLatestBackupAfterStartup().catch(err => {
        console.error("[STARTUP_RESTORE_CHECK] 起動後リストア確認でエラー:", err.message);
      });
    }, 800);});
}

start().catch(err => {
  console.error("[起動失敗]", err);
  process.exit(1);
});

















