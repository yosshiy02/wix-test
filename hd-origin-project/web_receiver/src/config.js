const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const projectRoot = path.join(__dirname, "..", "..");
const webDir = path.join(projectRoot, "web_receiver");
const publicDir = path.join(webDir, "public");

const backupDir = path.isAbsolute(process.env.BACKUP_DIR || "")
  ? process.env.BACKUP_DIR
  : path.join(projectRoot, process.env.BACKUP_DIR || "backup");

const pgBinPath = process.env.PG_BIN_PATH || "C:\\Program Files\\PostgreSQL\\17\\bin";

module.exports = {
  PORT: Number(process.env.PORT || 3000),
  projectRoot,
  webDir,
  publicDir,
  backupDir,
  pgBinPath,
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: String(process.env.DB_PASSWORD || ""),
  },
};


