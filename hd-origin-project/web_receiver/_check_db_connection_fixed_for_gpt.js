const fs = require("fs");
const dotenv = require("dotenv");
const { Pool } = require("pg");

const envPath = process.argv[2];
const reportPath = process.argv[3];
const dbHost = process.argv[4];
const dbPort = process.argv[5];
const dbName = process.argv[6];
const dbUser = process.argv[7];

dotenv.config({
  path: envPath,
  override: true
});

const dbPassword = String(process.env.DB_PASSWORD || "");

async function main() {
  const lines = [];

  lines.push("DB接続確認 固定値");
  lines.push("=================");
  lines.push("");
  lines.push("ENV_PATH: " + envPath);
  lines.push("DB_HOST: " + dbHost);
  lines.push("DB_PORT: " + dbPort);
  lines.push("DB_NAME: " + dbName);
  lines.push("DB_USER: " + dbUser);
  lines.push("DB_PASSWORD: " + (dbPassword ? "********" : "未設定"));
  lines.push("");

  const pool = new Pool({
    host: dbHost,
    port: Number(dbPort),
    database: dbName,
    user: dbUser,
    password: dbPassword
  });

  const result = await pool.query(`
    select
      current_user as current_user,
      current_database() as current_database
  `);

  lines.push("[接続確認]");
  lines.push("OK");
  lines.push("current_user: " + result.rows[0].current_user);
  lines.push("current_database: " + result.rows[0].current_database);

  await pool.end();

  fs.writeFileSync(reportPath, lines.join("\r\n"), "utf8");
}

main().catch(err => {
  const lines = [];

  lines.push("DB接続確認 固定値 エラー");
  lines.push("=========================");
  lines.push("");
  lines.push("ENV_PATH: " + envPath);
  lines.push("DB_HOST: " + dbHost);
  lines.push("DB_PORT: " + dbPort);
  lines.push("DB_NAME: " + dbName);
  lines.push("DB_USER: " + dbUser);
  lines.push("DB_PASSWORD: " + (dbPassword ? "********" : "未設定"));
  lines.push("");
  lines.push(err.stack || err.message);

  fs.writeFileSync(reportPath, lines.join("\r\n"), "utf8");
  process.exitCode = 1;
});
