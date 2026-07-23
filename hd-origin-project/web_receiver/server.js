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

/* GPT2_RESTORE_DB_TERMINATE_GUARD_20260709_START */
function hdOriginIsExpectedRestoreDbTerminateError(err) {
  /*
    GPT00_RESTORE_ECONNRESET_GUARD_20260711

    DB再作成中に旧PostgreSQL接続が切断された場合だけ、
    ECONNRESETを想定内として扱う。
    通常稼働中のECONNRESETは無視しない。
  */
  const code = String(err && err.code ? err.code : "");
  const message = String(
    err && err.message
      ? err.message
      : err || ""
  );

  return (
    process.env.HD_ORIGIN_DB_RECREATE_IN_PROGRESS === "1" &&
    (
      code === "57P01" ||
      code === "ECONNRESET" ||
      message.includes(
        "terminating connection due to administrator command"
      ) ||
      message.includes("Connection terminated") ||
      message.includes("read ECONNRESET")
    )
  );
}
process.on("uncaughtException", err => {
  if (hdOriginIsExpectedRestoreDbTerminateError(err)) {
    console.warn("[RESTORE_DB_RECREATE] DB再作成中の接続切断を無視しました:", err.message || err);
    return;
  }

  console.error("[UNCAUGHT_EXCEPTION]", err);
  process.exit(1);
});

process.on("unhandledRejection", reason => {
  if (hdOriginIsExpectedRestoreDbTerminateError(reason)) {
    console.warn("[RESTORE_DB_RECREATE] DB再作成中の非同期接続切断を無視しました:", reason.message || reason);
    return;
  }

  console.error("[UNHANDLED_REJECTION]", reason);
  process.exit(1);
});
/* GPT2_RESTORE_DB_TERMINATE_GUARD_20260709_END */


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
/* GPT00_BANK_ROUTE_REQUIRE_20260711_START */
const { handleBankRoutes } = require("./src/bank/bank.routes");
/* GPT00_BANK_ROUTE_REQUIRE_20260711_END */
/* GPT00_SALES_ROUTE_REQUIRE_20260712_START */
const { handleSalesRoutes } = require("./src/sales/sales.routes");
/* GPT00_SALES_ROUTE_REQUIRE_20260712_END */
/* GPT2_CALENDAR_WORKFLOW_OPENAI_REQUIRE_20260715_START */
const { handleCalendarWorkflowRoutes } = require("./src/calendar/calendarWorkflow.routes");
/* GPT2_CALENDAR_WORKFLOW_OPENAI_REQUIRE_20260715_END */
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
/* HD_ORIGIN_RESTART_BUTTON_GITUP_20260710_START */
/* GPT00_ALL_PC_GIT_SYNC_20260715_START */
function hdOriginRestartGitRun(args, cwd) {
  const { execFileSync } = require("child_process");

  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024
    });
  } catch (err) {
    const stdout =
      err && err.stdout
        ? String(err.stdout).trim()
        : "";

    const stderr =
      err && err.stderr
        ? String(err.stderr).trim()
        : "";

    const detail = [
      `git ${args.join(" ")} failed.`,
      stderr,
      stdout
    ].filter(Boolean).join("\n");

    const wrapped = new Error(detail);
    wrapped.stdout = stdout;
    wrapped.stderr = stderr;
    wrapped.exitCode =
      err && typeof err.status === "number"
        ? err.status
        : undefined;

    throw wrapped;
  }
}

function hdOriginRestartGitRunPathChunks(
  baseArgs,
  paths,
  cwd
) {
  const chunkSize = 100;

  for (
    let index = 0;
    index < paths.length;
    index += chunkSize
  ) {
    const chunk = paths.slice(
      index,
      index + chunkSize
    );

    hdOriginRestartGitRun(
      [
        ...baseArgs,
        "--",
        ...chunk
      ],
      cwd
    );
  }
}

function hdOriginRestartFindGitRoot(startPath) {
  let currentPath = path.resolve(startPath);

  while (currentPath) {
    const gitMarker = path.join(
      currentPath,
      ".git"
    );

    if (fs.existsSync(gitMarker)) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);

    if (
      !parentPath ||
      parentPath === currentPath
    ) {
      break;
    }

    currentPath = parentPath;
  }

  return "";
}

function hdOriginRestartNormalizeGitPath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .trim();
}

function hdOriginRestartPathIsExcluded(filePath) {
  const value =
    hdOriginRestartNormalizeGitPath(
      filePath
    ).toLowerCase();

  if (!value) {
    return true;
  }

  const gptTempPattern =
    /(^|\/)gpt(?:2|3)?[^\/]*\/(before|after|apply|undo|memo|00_[^\/]*)(\/|$)/i;

  if (gptTempPattern.test(value)) {
    return true;
  }

  const excludedFolderPatterns = [
    /(^|\/)\.git(\/|$)/i,
    /(^|\/)node_modules(\/|$)/i,
    /(^|\/)backups?(\/|$)/i,
    /(^|\/)uploads?(\/|$)/i,
    /(^|\/)tmp(\/|$)/i,
    /(^|\/)temp(\/|$)/i,
    /(^|\/)\.cache(\/|$)/i
  ];

  if (
    excludedFolderPatterns.some(
      pattern => pattern.test(value)
    )
  ) {
    return true;
  }

  const fileName =
    value.split("/").pop() || "";

  const excludedFileNames = new Set([
    ".env",
    "project_status_for_gpt.txt",
    "hd_origin_runtime_paths.txt",
    "hd_origin_restart_in_progress.json",
    "hd_origin_restarting.flag"
  ]);

  if (excludedFileNames.has(fileName)) {
    return true;
  }

  const excludedExtensions = [
    ".accdb",
    ".laccdb",
    ".mdb",
    ".backup",
    ".data.backup",
    ".bak",
    ".tmp",
    ".lock",
    ".log"
  ];

  return excludedExtensions.some(
    extension => value.endsWith(extension)
  );
}

function hdOriginRestartSplitNullPaths(output) {
  return String(output || "")
    .split("\0")
    .map(hdOriginRestartNormalizeGitPath)
    .filter(Boolean);
}

function hdOriginRestartChangedPaths(repoRoot) {
  const workingOutput =
    hdOriginRestartGitRun(
      [
        "-c",
        "core.quotepath=false",
        "diff",
        "--name-only",
        "-z",
        "--diff-filter=ACDMRTUXB"
      ],
      repoRoot
    );

  const stagedOutput =
    hdOriginRestartGitRun(
      [
        "-c",
        "core.quotepath=false",
        "diff",
        "--cached",
        "--name-only",
        "-z",
        "--diff-filter=ACDMRTUXB"
      ],
      repoRoot
    );

  const untrackedOutput =
    hdOriginRestartGitRun(
      [
        "-c",
        "core.quotepath=false",
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z"
      ],
      repoRoot
    );

  return [
    ...new Set([
      ...hdOriginRestartSplitNullPaths(
        workingOutput
      ),
      ...hdOriginRestartSplitNullPaths(
        stagedOutput
      ),
      ...hdOriginRestartSplitNullPaths(
        untrackedOutput
      )
    ])
  ];
}

function hdOriginRestartHasRemoteBranch(
  repoRoot,
  branch
) {
  try {
    hdOriginRestartGitRun(
      [
        "show-ref",
        "--verify",
        "--quiet",
        `refs/remotes/origin/${branch}`
      ],
      repoRoot
    );

    return true;
  } catch {
    return false;
  }
}

async function hdOriginRunRestartButtonGitUp(
  action
) {
  /*
    全PCを同じ状態にするための処理順:

    1. 一時ファイル・DB・秘密情報を除外する。
    2. それ以外の全変更を自動抽出する。
    3. 全対象をgit add・git commitする。
    4. GitHubからfetch・pull --rebaseする。
    5. GitHubへpushする。
    6. ローカルとoriginが完全一致したことを確認する。
    7. 一致後にだけDBバックアップと再起動へ進む。
  */

  const projectRoot =
    config.projectRoot ||
    path.resolve(__dirname, "..");

  const repoRoot =
    hdOriginRestartFindGitRoot(
      projectRoot
    );

  if (!repoRoot) {
    throw new Error(
      "Git repository root was not found."
    );
  }

  const branch =
    hdOriginRestartGitRun(
      [
        "branch",
        "--show-current"
      ],
      repoRoot
    ).trim();

  if (!branch) {
    throw new Error(
      "Current Git branch could not be resolved."
    );
  }

  const statusBefore =
    hdOriginRestartGitRun(
      [
        "-c",
        "core.quotepath=false",
        "status",
        "--short",
        "--branch"
      ],
      repoRoot
    ).trim();

  const allChangedPaths =
    hdOriginRestartChangedPaths(
      repoRoot
    );

  const excludedPaths =
    allChangedPaths.filter(
      hdOriginRestartPathIsExcluded
    );

  const targetPaths =
    allChangedPaths.filter(
      filePath =>
        !hdOriginRestartPathIsExcluded(
          filePath
        )
    );

  const stagedBefore =
    hdOriginRestartSplitNullPaths(
      hdOriginRestartGitRun(
        [
          "-c",
          "core.quotepath=false",
          "diff",
          "--cached",
          "--name-only",
          "-z"
        ],
        repoRoot
      )
    );

  const excludedStagedPaths =
    stagedBefore.filter(
      hdOriginRestartPathIsExcluded
    );

  if (excludedStagedPaths.length > 0) {
    hdOriginRestartGitRunPathChunks(
      [
        "reset",
        "-q",
        "HEAD"
      ],
      excludedStagedPaths,
      repoRoot
    );
  }

  if (targetPaths.length > 0) {
    hdOriginRestartGitRunPathChunks(
      [
        "add",
        "-A"
      ],
      targetPaths,
      repoRoot
    );
  }

  const stagedAfterAdd =
    hdOriginRestartSplitNullPaths(
      hdOriginRestartGitRun(
        [
          "-c",
          "core.quotepath=false",
          "diff",
          "--cached",
          "--name-only",
          "-z"
        ],
        repoRoot
      )
    );

  const prohibitedStagedPaths =
    stagedAfterAdd.filter(
      hdOriginRestartPathIsExcluded
    );

  if (prohibitedStagedPaths.length > 0) {
    throw new Error(
      [
        "Excluded files remain staged.",
        "",
        ...prohibitedStagedPaths
      ].join("\n")
    );
  }

  const committablePaths =
    stagedAfterAdd.filter(
      filePath =>
        !hdOriginRestartPathIsExcluded(
          filePath
        )
    );

  const normalizedAction =
    String(action || "system-exit")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-");

  const commitMessage =
    "HD Origin full sync before server " +
    normalizedAction +
    " " +
    new Date().toISOString();

  let committed = false;
  let commitHash =
    hdOriginRestartGitRun(
      [
        "rev-parse",
        "--short",
        "HEAD"
      ],
      repoRoot
    ).trim();

  if (committablePaths.length > 0) {
    hdOriginRestartGitRun(
      [
        "commit",
        "-m",
        commitMessage
      ],
      repoRoot
    );

    committed = true;

    commitHash =
      hdOriginRestartGitRun(
        [
          "rev-parse",
          "--short",
          "HEAD"
        ],
        repoRoot
      ).trim();
  }

  hdOriginRestartGitRun(
    [
      "fetch",
      "origin"
    ],
    repoRoot
  );

  const remoteBranchExisted =
    hdOriginRestartHasRemoteBranch(
      repoRoot,
      branch
    );

  if (remoteBranchExisted) {
    try {
      hdOriginRestartGitRun(
        [
          "pull",
          "--rebase",
          "--autostash",
          "origin",
          branch
        ],
        repoRoot
      );
    } catch (pullError) {
      try {
        hdOriginRestartGitRun(
          [
            "rebase",
            "--abort"
          ],
          repoRoot
        );
      } catch {}

      throw pullError;
    }
  }

  hdOriginRestartGitRun(
    [
      "push",
      "-u",
      "origin",
      branch
    ],
    repoRoot
  );

  hdOriginRestartGitRun(
    [
      "fetch",
      "origin"
    ],
    repoRoot
  );

  const syncCounts =
    hdOriginRestartGitRun(
      [
        "rev-list",
        "--left-right",
        "--count",
        `origin/${branch}...${branch}`
      ],
      repoRoot
    )
      .trim()
      .split(/\s+/)
      .map(value => Number(value));

  const remoteOnly =
    Number(syncCounts[0] || 0);

  const localOnly =
    Number(syncCounts[1] || 0);

  if (
    remoteOnly !== 0 ||
    localOnly !== 0
  ) {
    throw new Error(
      [
        "Git synchronization verification failed.",
        `REMOTE_ONLY=${remoteOnly}`,
        `LOCAL_ONLY=${localOnly}`
      ].join("\n")
    );
  }

  const statusAfter =
    hdOriginRestartGitRun(
      [
        "-c",
        "core.quotepath=false",
        "status",
        "--short",
        "--branch"
      ],
      repoRoot
    ).trim();

  return {
    ok: true,
    committed,
    pushed: true,
    synchronized: true,
    repo_root: repoRoot,
    branch,
    commit_hash: commitHash,
    commit_message:
      committed
        ? commitMessage
        : "",
    target_paths: targetPaths,
    excluded_paths: excludedPaths,
    remote_only: remoteOnly,
    local_only: localOnly,
    status_before: statusBefore,
    status_after: statusAfter,
    message:
      committed
        ? "All eligible project changes were committed and pushed. Local and GitHub are synchronized."
        : "No new eligible changes required a commit. Existing local commits were pushed and synchronization was verified."
  };
}
/* GPT00_ALL_PC_GIT_SYNC_20260715_END */
/* HD_ORIGIN_RESTART_BUTTON_GITUP_20260710_END */

async function hdOriginRunBackupThenExit(res, reason, exitCode) {
  if (hdOriginSystemExitInProgress) {
    sendJson(res, 409, {
      ok: false,
      error: "A shutdown or restart operation is already running."
    });
    return;
  }

  hdOriginSystemExitInProgress = true;

  let gitup = null;

  try {
    /*
      GitUp runs only for the restart and shutdown button APIs.
      It never runs during normal startup.
    */
    const systemExitAction =
      String(reason || "").toLowerCase();

    const shouldRunGitUp =
      systemExitAction === "restart" ||
      systemExitAction === "shutdown";

    if (shouldRunGitUp) {
      console.log(
        "[SYSTEM_EXIT_GITUP] started:",
        systemExitAction
      );

      try {
        gitup =
          await hdOriginRunRestartButtonGitUp(systemExitAction);

        console.log(
          "[SYSTEM_EXIT_GITUP] completed:",
          gitup.commit_hash || "no changes"
        );
      } catch (gitErr) {
        hdOriginSystemExitInProgress = false;

        console.error(
          "[SYSTEM_EXIT_GITUP] failed; action cancelled:",
          gitErr.message
        );

        sendJson(res, 500, {
          ok: false,
          stage: "gitup",
          error:
            "GitUp failed. The shutdown or restart action was cancelled.",
          detail: gitErr.message,
          stderr: gitErr.stderr || undefined
        });

        return;
      }
    }

    /*
      The existing DB backup begins only after GitUp succeeds.
    */
    const backup =
      await hdOriginCreateExitBackup(reason);

    if (
      String(reason || "").toLowerCase() === "restart"
    ) {
      hdOriginWriteRestartMarker("restart");
    }

    sendJson(res, 200, {
      ok: true,
      message:
        "Git commit, GitHub push, synchronization verification, and the pre-exit DB backup completed.",
      action: reason,
      gitup,
      backup
    });

    hdOriginExitLater(exitCode);
  } catch (err) {
    hdOriginSystemExitInProgress = false;

    sendJson(res, 500, {
      ok: false,
      stage: "backup",
      error:
        "The pre-shutdown or pre-restart DB backup failed.",
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

function hdOriginStartupRestartMarkerFile() {
  return path.join(config.projectRoot, "HD_ORIGIN_RESTART_IN_PROGRESS.json");
}

function hdOriginWriteRestartMarker(reason) {
  try {
    const payload = {
      reason: String(reason || "restart"),
      created_at: new Date().toISOString(),
      pc: hdOriginGetCurrentPcName()
    };

    fs.writeFileSync(
      hdOriginStartupRestartMarkerFile(),
      JSON.stringify(payload, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error("[STARTUP_RESTORE_CHECK] 再起動マーカー作成失敗:", err.message);
  }
}

function hdOriginConsumeRestartMarker() {
  const filePath = hdOriginStartupRestartMarkerFile();

  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, "utf8");

    try {
      fs.unlinkSync(filePath);
    } catch {}

    let marker = null;

    try {
      marker = JSON.parse(raw);
    } catch {
      marker = { reason: "restart" };
    }

    const reason = String(marker && marker.reason ? marker.reason : "").toLowerCase();
    const createdAtRaw = marker && marker.created_at ? marker.created_at : "";
    const createdAtMs = createdAtRaw ? new Date(createdAtRaw).getTime() : 0;
    const ageMs = createdAtMs ? Date.now() - createdAtMs : Number.MAX_SAFE_INTEGER;
    const maxAgeMs = 5 * 60 * 1000;
    const markerPc = String(marker && marker.pc ? marker.pc : "").trim();
    const currentPc = hdOriginGetCurrentPcName();

    if (reason !== "restart") {
      console.log("[STARTUP_RESTORE_CHECK] 再起動マーカーはrestartではないため通常起動扱いにします。");
      return null;
    }

    if (!createdAtMs || ageMs < 0 || ageMs > maxAgeMs) {
      console.log("[STARTUP_RESTORE_CHECK] 古い再起動マーカーを無視します。通常起動扱いにします。");
      return null;
    }

    if (markerPc && markerPc !== currentPc) {
      console.log("[STARTUP_RESTORE_CHECK] 別PCの再起動マーカーを無視します。通常起動扱いにします。");
      return null;
    }

    return marker;
  } catch (err) {
    console.error("[STARTUP_RESTORE_CHECK] 再起動マーカー確認失敗:", err.message);
    return null;
  }
}
function hdOriginFormatStartupBackupDate(value) {
  try {
    if (!value) return "";
    return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  } catch {
    return String(value || "");
  }
}

function hdOriginLimitWindowsDialogText(value, maxLength = 1800) {
  const text = String(value || "");

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength) + "\n\n...以下省略。詳細は黒い起動画面のログを確認してください。";
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
      message: hdOriginLimitWindowsDialogText(message, 1800),
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

function hdOriginOpenProjectScreenAfterRestoreAnswer() {
  const url = `http://localhost:${config.PORT}`;
  const chromePath = String(process.env.CHROME_PATH || "").trim();

  try {
    const { spawn } = require("child_process");

    if (process.platform === "win32") {
      if (chromePath && fs.existsSync(chromePath)) {
        const child = spawn(chromePath, [url], {
          detached: true,
          stdio: "ignore"
        });
        child.unref();
      } else {
        const child = spawn("cmd.exe", ["/c", "start", "", url], {
          detached: true,
          stdio: "ignore",
          windowsHide: true
        });
        child.unref();
      }
    } else {
      const child = spawn("xdg-open", [url], {
        detached: true,
        stdio: "ignore"
      });
      child.unref();
    }

    console.log(`[STARTUP_RESTORE_CHECK] プロジェクト画面を開きました: ${url}`);
  } catch (err) {
    console.error("[STARTUP_RESTORE_CHECK] プロジェクト画面を開けませんでした:", err.message);
    console.log(`[STARTUP_RESTORE_CHECK] 手動で開いてください: ${url}`);
  }
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
    const shortErrorMessage = hdOriginLimitWindowsDialogText(err && err.message ? err.message : "原因不明", 700);

    await hdOriginShowWindowsMessageBox(
      "HD Origin Project リストア失敗",
      [
        "リストアに失敗しました。",
        "",
        shortErrorMessage,
        "",
        "詳細は黒い起動画面のログを確認してください。",
        "この画面はそのまま使用せず、復旧確認をしてください。"
      ].join("\n"),
      "OK",
      "Error"
    );

    return false;
  }
}

async function hdOriginRunStartupRestoreCheckThenOpenProject() {
  const restartMarker = hdOriginConsumeRestartMarker();

  if (restartMarker && String(restartMarker.reason || "").toLowerCase() === "restart") {
    console.log("[STARTUP_RESTORE_CHECK] 再起動ボタン経由のため、リストア確認とメイン画面OPENを省略します。");
    console.log("[STARTUP_RESTORE_CHECK] 既存ブラウザ画面側が、復帰後に現在ページをリロードします。");
    return;
  }

  await hdOriginConfirmRestoreLatestBackupAfterStartup();
  hdOriginOpenProjectScreenAfterRestoreAnswer();
}
/* HD_ORIGIN_STARTUP_RESTORE_CHECK_20260706_END */
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      if (handleSystemRestartRoute(req, res)) return;
      /* GPT00_BANK_ROUTE_HANDLER_20260711_START */
      if (await handleBankRoutes(req, res)) return;
      /* GPT00_SALES_ROUTE_HANDLER_20260712_START */
      if (await handleSalesRoutes(req, res)) return;
      /* GPT00_SALES_ROUTE_HANDLER_20260712_END */
      /* GPT00_BANK_ROUTE_HANDLER_20260711_END */
      /* GPT2_CALENDAR_WORKFLOW_OPENAI_HANDLER_20260715_START */
if (await handleCalendarWorkflowRoutes(req, res)) return;
/* GPT2_CALENDAR_WORKFLOW_OPENAI_HANDLER_20260715_END */
      if (await handleMasterRoutes(req, res)) return;
      if (await handleItemsRoutes(req, res)) return;
      if (await handleBackupRoutes(req, res) || res.headersSent || res.writableEnded) return;
      if (await handleProjectBackupRoutes(req, res) || res.headersSent || res.writableEnded) return;
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

      if (res.headersSent || res.writableEnded) return;
      return sendJson(res, 404, { ok: false, error: "API not found" });
    }

    serveStatic(req, res);
  } catch (err) {
    console.error(err);

    if (res.headersSent || res.writableEnded) {
      console.error(
        "[HTTP_RESPONSE_ALREADY_SENT] 二重レスポンスを停止しました:",
        err.message
      );
      return;
    }

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
      hdOriginRunStartupRestoreCheckThenOpenProject().catch(err => {
        console.error("[STARTUP_RESTORE_CHECK] 起動後リストア確認でエラー:", err.message);
        hdOriginOpenProjectScreenAfterRestoreAnswer();
      });
    }, 800);});
}

start().catch(err => {
  console.error("[起動失敗]", err);
  process.exit(1);
});
























