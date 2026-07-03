const fs = require("fs");
const path = require("path");
const config = require("../config");
const { runCommand } = require("../utils/command");
const { timestamp } = require("../utils/time");

function projectBackupDir() {
  return path.join(config.backupDir, "project");
}

function listProjectBackups() {
  const dir = projectBackupDir();

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter(name => name.endsWith(".zip"))
    .map(name => {
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);

      return {
        file_name: name,
        full_path: fullPath,
        size_bytes: stat.size,
        updated_at: stat.mtime
      };
    })
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

function cleanupOldProjectBackups() {
  const keep = Number(process.env.PROJECT_BACKUP_KEEP || 5);
  const backups = listProjectBackups();
  const deleteTargets = backups.slice(keep);
  const deleted = [];

  for (const target of deleteTargets) {
    try {
      fs.unlinkSync(target.full_path);
      deleted.push(target.file_name);
    } catch (err) {
      console.error("project backup cleanup failed:", target.file_name, err.message);
    }
  }

  return {
    keep_project_backup: keep,
    deleted
  };
}

async function createProjectBackup() {
  const dir = projectBackupDir();
  fs.mkdirSync(dir, { recursive: true });

  const fileName = `hd-origin-project_program_${timestamp()}.zip`;
  const filePath = path.join(dir, fileName);

  const script = `
$ErrorActionPreference = "Stop"

$Source = ${JSON.stringify(config.projectRoot)}
$Dest = ${JSON.stringify(filePath)}
$Temp = Join-Path $env:TEMP ("hd_origin_project_backup_" + [guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Path $Temp -Force | Out-Null

$ExcludeDirs = @(
  (Join-Path $Source ".git"),
  (Join-Path $Source "node_modules"),
  (Join-Path $Source "backup"),
  (Join-Path $Source ".vs"),
  (Join-Path $Source "bin"),
  (Join-Path $Source "obj"),
  (Join-Path $Source "__pycache__"),
  (Join-Path $Source "_manual_patch_backup"),
  (Join-Path $Source "GPTが見たいファイル一時フォルダ"),
  (Join-Path $Source "web_receiver\\node_modules")
)

$ExcludeFiles = @(
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
  "*.log",
  "npm-debug.log*",
  "*.tmp",
  "*.bak",
  "*.bak_*",
  "*.broken_*",
  "*_tmp.js",
  "00_*.txt"
)

try {
  robocopy $Source $Temp /E /XD $ExcludeDirs /XF $ExcludeFiles /R:1 /W:1 | Out-Null

  if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed. code=$LASTEXITCODE"
  }

  if (Test-Path $Dest) {
    Remove-Item $Dest -Force
  }

  Compress-Archive -Path (Join-Path $Temp "*") -DestinationPath $Dest -Force
}
finally {
  if (Test-Path $Temp) {
    Remove-Item $Temp -Recurse -Force
  }
}
`;

  await runCommand("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script
  ]);

  const stat = fs.statSync(filePath);
  const cleanup = cleanupOldProjectBackups();

  return {
    file_name: fileName,
    full_path: filePath,
    size_bytes: stat.size,
    created_at: stat.mtime,
    cleanup
  };
}

module.exports = {
  listProjectBackups,
  createProjectBackup,
};