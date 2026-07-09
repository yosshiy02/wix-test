const fs = require("fs");
const path = require("path");
const config = require("../config");
const { runCommand } = require("../utils/command");
const { timestamp } = require("../utils/time");
const { listMigrationStatus } = require("../migrations/migration.service");

fs.mkdirSync(config.backupDir, { recursive: true });

function samePath(a, b) {
  if (!a || !b) return false;

  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

function backupBaseName(fileName) {
  return String(fileName || "").replace(/\.backup$/i, "");
}

function sidecarBackupFiles(fileName) {
  const base = backupBaseName(fileName);

  return {
    schema_file_name: `${base}.schema.sql`,
    data_file_name: `${base}.data.backup`
  };
}

function backupArtifactInfo(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  const stat = fs.statSync(filePath);

  return {
    file_name: path.basename(filePath),
    full_path: filePath,
    size_bytes: stat.size,
    updated_at: stat.mtime
  };
}

function cloneOneBackupFile(filePath, fileName) {
  const cloneDir = config.backupCloneDir;

  if (!cloneDir) {
    return {
      enabled: false,
      skipped: true,
      reason: "クローン保存先が未設定です。"
    };
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return {
      enabled: true,
      skipped: true,
      file_name: fileName,
      reason: "コピー元ファイルが見つからないため、コピーを省略しました。"
    };
  }

  if (samePath(config.backupDir, cloneDir)) {
    return {
      enabled: true,
      skipped: true,
      file_name: fileName,
      reason: "第1保存先と第2保存先が同じため、コピーを省略しました。",
      backup_clone_dir: cloneDir
    };
  }

  fs.mkdirSync(cloneDir, { recursive: true });

  const clonePath = path.join(cloneDir, fileName);

  fs.copyFileSync(filePath, clonePath);

  const stat = fs.statSync(clonePath);

  return {
    enabled: true,
    skipped: false,
    file_name: fileName,
    full_path: clonePath,
    size_bytes: stat.size,
    copied_at: stat.mtime
  };
}

function cloneBackupSet(files) {
  return {
    full: cloneOneBackupFile(files.full_path, files.full_file_name),
    schema: cloneOneBackupFile(files.schema_path, files.schema_file_name),
    data: cloneOneBackupFile(files.data_path, files.data_file_name)
  };
}

function pgTool(name) {
  return path.join(config.pgBinPath, `${name}.exe`);
}

function pgEnv() {
  return {
    ...process.env,
    PGPASSWORD: process.env.DB_PASSWORD || "",
  };
}

function isFullBackupFile(name) {
  return (
    name.endsWith(".backup") &&
    !name.endsWith(".data.backup")
  );
}

function listBackups() {
  if (!fs.existsSync(config.backupDir)) {
    return [];
  }

  const backups = fs.readdirSync(config.backupDir)
    .filter(isFullBackupFile)
    .map(name => {
      const fullPath = path.join(config.backupDir, name);
      const stat = fs.statSync(fullPath);
      const isSafetyBackup = name.includes("_before_restore_");
      const sidecars = sidecarBackupFiles(name);
      const schemaPath = path.join(config.backupDir, sidecars.schema_file_name);
      const dataPath = path.join(config.backupDir, sidecars.data_file_name);

      return {
        file_name: name,
        full_path: fullPath,
        size_bytes: stat.size,
        updated_at: stat.mtime,
        backup_type: isSafetyBackup ? "before_restore" : "normal",
        is_safety_backup: isSafetyBackup,
        is_latest_normal: false,
        backup_format: "full",
        schema_backup: backupArtifactInfo(schemaPath),
        data_backup: backupArtifactInfo(dataPath)
      };
    })
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  const latestNormal = backups.find(b => !b.is_safety_backup);

  if (latestNormal) {
    latestNormal.is_latest_normal = true;
  }

  return backups;
}

function deleteIfExists(filePath, deleted) {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  fs.unlinkSync(filePath);
  deleted.push(path.basename(filePath));
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
      deleteIfExists(target.full_path, deleted);

      if (target.schema_backup) {
        deleteIfExists(target.schema_backup.full_path, deleted);
      }

      if (target.data_backup) {
        deleteIfExists(target.data_backup.full_path, deleted);
      }
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

  if (base.endsWith(".data.backup")) {
    throw new Error("data-onlyバックアップは本番リストア対象にできません。");
  }

  if (base !== filename) {
    throw new Error("不正なファイル名です。");
  }

  return base;
}

async function getMigrationSnapshot() {
  try {
    const status = await listMigrationStatus();
    const applied = status.filter(item => item.applied);
    const latest = applied.length ? applied[applied.length - 1] : null;

    return {
      ok: true,
      latest_version: latest ? latest.version : null,
      latest_name: latest ? latest.name : null,
      applied_count: applied.length,
      migrations: status
    };
  } catch (err) {
    return {
      ok: false,
      latest_version: null,
      latest_name: null,
      applied_count: 0,
      error: err.message
    };
  }
}

async function createSchemaOnlyBackup(schemaPath) {
  await runCommand(pgTool("pg_dump"), [
    "-h", process.env.DB_HOST || "127.0.0.1",
    "-p", String(process.env.DB_PORT || 5432),
    "-U", process.env.DB_USER || "postgres",
    "-d", process.env.DB_NAME,
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "-F", "p",
    "-f", schemaPath
  ], {
    env: pgEnv()
  });

  return backupArtifactInfo(schemaPath);
}

async function createDataOnlyBackup(dataPath) {
  await runCommand(pgTool("pg_dump"), [
    "-h", process.env.DB_HOST || "127.0.0.1",
    "-p", String(process.env.DB_PORT || 5432),
    "-U", process.env.DB_USER || "postgres",
    "-d", process.env.DB_NAME,
    "--data-only",
    "--no-owner",
    "--no-privileges",
    "-F", "c",
    "-b",
    "-v",
    "-f", dataPath
  ], {
    env: pgEnv()
  });

  return backupArtifactInfo(dataPath);
}

async function createBackup(prefix = process.env.DB_NAME || "database") {
  const dbName = process.env.DB_NAME;
  const stamp = timestamp();
  const fileName = `${prefix}_${stamp}.backup`;
  const filePath = path.join(config.backupDir, fileName);
  const sidecars = sidecarBackupFiles(fileName);
  const schemaPath = path.join(config.backupDir, sidecars.schema_file_name);
  const dataPath = path.join(config.backupDir, sidecars.data_file_name);

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

  const schemaBackup = await createSchemaOnlyBackup(schemaPath);
  const dataBackup = await createDataOnlyBackup(dataPath);

  const stat = fs.statSync(filePath);
  const migrationSnapshot = await getMigrationSnapshot();

  const cloneBackup = cloneBackupSet({
    full_file_name: fileName,
    full_path: filePath,
    schema_file_name: sidecars.schema_file_name,
    schema_path: schemaPath,
    data_file_name: sidecars.data_file_name,
    data_path: dataPath
  });

  const cleanup = cleanupOldBackups();

  return {
    file_name: fileName,
    full_path: filePath,
    size_bytes: stat.size,
    created_at: stat.mtime,
    backup_format: "full",
    backup_artifacts: {
      full: backupArtifactInfo(filePath),
      schema: schemaBackup,
      data: dataBackup
    },
    migration_version: migrationSnapshot.latest_version,
    migration_snapshot: migrationSnapshot,
    clone_backup: cloneBackup,
    cleanup
  };
}

function sqlIdentifier(value) {
  return `"${String(value || "").replace(/"/g, `""`)}"`;
}

function sqlLiteral(value) {
  return `'${String(value || "").replace(/'/g, `''`)}'`;
}

function maintenanceDatabaseName(dbName) {
  return String(dbName || "").toLowerCase() === "postgres" ? "template1" : "postgres";
}

async function recreateDatabaseForRestore(dbName) {
  const maintenanceDb = maintenanceDatabaseName(dbName);
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = String(process.env.DB_PORT || 5432);
  const user = process.env.DB_USER || "postgres";

  await runCommand(pgTool("psql"), [
    "-h", host,
    "-p", port,
    "-U", user,
    "-d", maintenanceDb,
    "-v", "ON_ERROR_STOP=1",
    "-c", `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${sqlLiteral(dbName)} AND pid <> pg_backend_pid();`,
    "-c", `DROP DATABASE IF EXISTS ${sqlIdentifier(dbName)};`,
    "-c", `CREATE DATABASE ${sqlIdentifier(dbName)} WITH TEMPLATE template0 ENCODING 'UTF8';`
  ], {
    env: pgEnv()
  });
}

async function restoreBackup(fileName) {
  const safeName = safeBackupFileName(fileName);
  const filePath = path.join(config.backupDir, safeName);
  const dbName = process.env.DB_NAME;

  if (!dbName) {
    throw new Error("DB_NAME が未設定です。");
  }

  if (!fs.existsSync(filePath)) {
    const err = new Error("指定されたバックアップファイルが見つかりません。");
    err.statusCode = 404;
    throw err;
  }

  const safetyBackup = await createBackup(`${dbName}_before_restore`);

  await recreateDatabaseForRestore(dbName);

  await runCommand(pgTool("pg_restore"), [
    "-h", process.env.DB_HOST || "127.0.0.1",
    "-p", String(process.env.DB_PORT || 5432),
    "-U", process.env.DB_USER || "postgres",
    "-d", dbName,
    "--exit-on-error",
    "--no-owner",
    "--no-privileges",
    "-v",
    filePath
  ], {
    env: pgEnv()
  });

  return {
    restored_file: safeName,
    safety_backup: safetyBackup,
    restore_mode: "recreate_database"
  };
}

module.exports = {
  listBackups,
  createBackup,
  restoreBackup,
};

