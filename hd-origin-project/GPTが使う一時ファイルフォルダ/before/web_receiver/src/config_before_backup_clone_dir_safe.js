const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const projectRoot = path.join(__dirname, "..", "..");
const runtimePathsFile = path.join(projectRoot, "HD_ORIGIN_RUNTIME_PATHS.txt");
const envPathFile = path.join(projectRoot, ".env_path.txt");

function readKeyValueFile(filePath) {
  const values = {};

  if (!filePath || !fs.existsSync(filePath)) {
    return values;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = String(line || "").trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");

    if (eq < 0) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();

    if (key) {
      values[key] = value;
    }
  }

  return values;
}

const runtimeValues = readKeyValueFile(runtimePathsFile);

for (const [key, value] of Object.entries(runtimeValues)) {
  if (value && !process.env[key]) {
    process.env[key] = value;
  }
}

let envPath = process.env.HD_ORIGIN_ENV_PATH || "";

if (!envPath && fs.existsSync(envPathFile)) {
  envPath = fs.readFileSync(envPathFile, "utf8").trim();
}

if (!envPath) {
  envPath = path.join(projectRoot, ".env");
}

dotenv.config({
  path: envPath,
  override: false
});

const webDir = path.join(projectRoot, "web_receiver");
const publicDir = path.join(webDir, "public");

const backupDir = path.isAbsolute(process.env.BACKUP_DIR || "")
  ? process.env.BACKUP_DIR
  : path.join(projectRoot, process.env.BACKUP_DIR || "backup");

const pgBinPath = process.env.PG_BIN_PATH || "C:\\Program Files\\PostgreSQL\\17\\bin";

const receiptRoot = path.isAbsolute(process.env.HD_ORIGIN_RECEIPT_ROOT || "")
  ? process.env.HD_ORIGIN_RECEIPT_ROOT
  : path.join(projectRoot, process.env.HD_ORIGIN_RECEIPT_ROOT || "ORIGIN会計ソフト\\レシート関係");

module.exports = {
  PORT: Number(process.env.PORT || 3000),
  projectRoot,
  runtimePathsFile,
  envPath,
  webDir,
  publicDir,
  backupDir,
  pgBinPath,
  receiptRoot,
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: String(process.env.DB_PASSWORD || ""),
  },
};