const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function loadKeyValueFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log("[RUNTIME] not found:", filePath);
    return;
  }

  const text = fs.readFileSync(filePath, "utf8");

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index <= 0) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    if (key) {
      process.env[key] = value;
    }
  }

  console.log("[RUNTIME] loaded:", filePath);
}

function loadSecretEnv() {
  const candidates = [];

  if (process.env.HD_ORIGIN_ENV_PATH) {
    candidates.push(process.env.HD_ORIGIN_ENV_PATH);
  }

  candidates.push(path.join(projectRoot, ".env"));

  for (const envPath of candidates) {
    if (!envPath || !fs.existsSync(envPath)) continue;

    require("dotenv").config({ path: envPath, override: false });
    console.log("[ENV] loaded:", envPath);
    return;
  }

  console.log("[ENV] not found");
}

loadKeyValueFile(path.join(projectRoot, "HD_ORIGIN_RUNTIME_PATHS.txt"));
loadSecretEnv();

const { Client } = require("pg");
const config = require("./src/config");

async function main() {
  const db = {
    host: config.db.host,
    port: Number(config.db.port),
    database: config.db.database,
    user: config.db.user,
    password: String(config.db.password || "")
  };

  console.log("\n[DB CONNECT]");
  console.log({
    host: db.host,
    port: db.port,
    database: db.database,
    user: db.user,
    password: db.password ? "********" : ""
  });

  if (!db.database) throw new Error("DB_NAME が読めていません。");
  if (!db.user) throw new Error("DB_USER が読めていません。");
  if (!db.password) throw new Error("DB_PASSWORD が読めていません。");

  const client = new Client(db);
  await client.connect();

  console.log("\n[税処理マスタ]");
  const treatments = await client.query(`
    SELECT treatment_name, treatment_code, is_tax_included, sort_order
    FROM expenses.tax_treatments
    ORDER BY sort_order
  `);
  console.table(treatments.rows);

  console.log("\n[追加カラム確認]");
  const columns = await client.query(`
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE column_name ILIKE '%tax_treatment%'
    ORDER BY table_schema, table_name, ordinal_position
  `);
  console.table(columns.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});