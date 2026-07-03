const fs = require("fs");
const dotenv = require("dotenv");
const { Pool } = require("pg");

const envPath = process.argv[2];
const reportPath = process.argv[3];

dotenv.config({
  path: envPath,
  override: true
});

async function main() {
  const lines = [];

  lines.push("ENV DB接続確認");
  lines.push("================");
  lines.push("");
  lines.push("ENV_PATH: " + envPath);
  lines.push("DB_HOST: " + (process.env.DB_HOST || ""));
  lines.push("DB_PORT: " + (process.env.DB_PORT || ""));
  lines.push("DB_NAME: " + (process.env.DB_NAME || ""));
  lines.push("DB_USER: " + (process.env.DB_USER || ""));
  lines.push("DB_PASSWORD: " + (process.env.DB_PASSWORD ? "********" : "未設定"));
  lines.push("");

  const pool = new Pool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: String(process.env.DB_PASSWORD || "")
  });

  const result = await pool.query(`
    select
      current_user as current_user,
      current_database() as current_database
  `);

  lines.push("[接続結果]");
  lines.push("OK");
  lines.push("current_user: " + result.rows[0].current_user);
  lines.push("current_database: " + result.rows[0].current_database);

  await pool.end();

  fs.writeFileSync(reportPath, lines.join("\r\n"), "utf8");
}

main().catch(err => {
  const lines = [];
  lines.push("ENV DB接続確認 エラー");
  lines.push("======================");
  lines.push("");
  lines.push("ENV_PATH: " + envPath);
  lines.push("DB_USER: " + (process.env.DB_USER || ""));
  lines.push("DB_PASSWORD: " + (process.env.DB_PASSWORD ? "********" : "未設定"));
  lines.push("");
  lines.push(err.stack || err.message);

  fs.writeFileSync(reportPath, lines.join("\r\n"), "utf8");
  process.exitCode = 1;
});
