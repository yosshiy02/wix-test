const fs = require("fs");
const path = require("path");
const config = require("../config");
const { runCommand } = require("../utils/command");
const { timestamp } = require("../utils/time");

fs.mkdirSync(config.backupDir, { recursive: true });

function pgTool(name) {
  return path.join(config.pgBinPath, `${name}.exe`);
}

function pgEnv() {
  return {
    ...process.env,
    PGPASSWORD: process.env.DB_PASSWORD || "",
  };
}

function listBackups() {
  if (!fs.existsSync(config.backupDir)) {
    return [];
  }

  const backups = fs.readdirSync(config.backupDir)
    .filter(name => name.endsWith(".backup"))
    .map(name => {
      const fullPath = path.join(config.backupDir, name);
      const stat = fs.statSync(fullPath);
      const isSafetyBackup = name.includes("_before_restore_");

      return {
        file_name: name,
        full_path: fullPath,
        size_bytes: stat.size,
        updated_at: stat.mtime,
        backup_type: isSafetyBackup ? "before_restore" : "normal",
        is_safety_backup: isSafetyBackup,
        is_latest_normal: false
      };
    })
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  const latestNormal = backups.find(b => !b.is_safety_backup);

  if (latestNormal) {
    latestNormal.is_latest_normal = true;
  }

  return backups;
}

function cleanupOldBackups() {
  const keepNormal = Number(process.env.BACKUP_KEEP_NORMAL || 10);
  const keepBeforeRestore = Number(process.env.BACKUP_KEEP_BEFORE_RESTORE || 3);

  const backups = listBackups();

  const normalBackups = backups
    .filter(b => !b.is_safety_backup)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  const safetyBackups = backups
    .filter(b => b.is_safety_backup)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  const deleteTargets = [
    ...normalBackups.slice(keepNormal),
    ...safetyBackups.slice(keepBeforeRestore)
  ];

  const deleted = [];

  for (const target of deleteTargets) {
    try {
      fs.unlinkSync(target.full_path);
      deleted.push(target.file_name);
    } catch (err) {
      console.error("backup cleanup failed:", target.file_name, err.message);
    }
  }

  return {
    keep_normal: keepNormal,
    keep_before_restore: keepBeforeRestore,
    deleted
  };
}

function safeBackupFileName(filename) {
  const base = path.basename(filename || "");

  if (!base.endsWith(".backup")) {
    throw new Error("backupファイルではありません。");
  }

  if (base !== filename) {
    throw new Error("不正なファイル名です。");
  }

  return base;
}

async function createBackup(prefix = process.env.DB_NAME || "database") {
  const dbName = process.env.DB_NAME;
  const fileName = `${prefix}_${timestamp()}.backup`;
  const filePath = path.join(config.backupDir, fileName);

  await runCommand(pgTool("pg_dump"), [
    "-h", process.env.DB_HOST || "127.0.0.1",
    "-p", String(process.env.DB_PORT || 5432),
    "-U", process.env.DB_USER || "postgres",
    "-d", dbName,
    "-F", "c",
    "-b",
    "-v",
    "-f", filePath
  ], {
    env: pgEnv()
  });

  const stat = fs.statSync(filePath);
  const cleanup = cleanupOldBackups();

  return {
    file_name: fileName,
    full_path: filePath,
    size_bytes: stat.size,
    created_at: stat.mtime,
    cleanup
  };
}

async function restoreBackup(fileName) {
  const safeName = safeBackupFileName(fileName);
  const filePath = path.join(config.backupDir, safeName);

  if (!fs.existsSync(filePath)) {
    const err = new Error("指定されたバックアップファイルが見つかりません。");
    err.statusCode = 404;
    throw err;
  }

  const safetyBackup = await createBackup(`${process.env.DB_NAME || "database"}_before_restore`);

  await runCommand(pgTool("pg_restore"), [
    "-h", process.env.DB_HOST || "127.0.0.1",
    "-p", String(process.env.DB_PORT || 5432),
    "-U", process.env.DB_USER || "postgres",
    "-d", process.env.DB_NAME,
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "-v",
    filePath
  ], {
    env: pgEnv()
  });

  return {
    restored_file: safeName,
    safety_backup: safetyBackup
  };
}

module.exports = {
  listBackups,
  createBackup,
  restoreBackup,
};
