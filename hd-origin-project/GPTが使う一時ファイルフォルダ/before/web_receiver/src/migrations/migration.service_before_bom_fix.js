const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");
const pool = require("../db");

function migrationsDir() {
  return path.join(config.projectRoot, "database", "migrations");
}

function checksumSha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function migrationVersionFromFile(fileName) {
  return fileName.replace(/\.sql$/i, "");
}

function migrationNameFromVersion(version) {
  return version.replace(/^\d{8}_\d+_/, "");
}

async function ensureMigrationTable(client = pool) {
  await client.query("CREATE SCHEMA IF NOT EXISTS system");

  await client.query(`
    CREATE TABLE IF NOT EXISTS system.schema_migrations (
      version text PRIMARY KEY,
      name text NOT NULL,
      file_name text NOT NULL,
      checksum_sha256 text,
      applied_at timestamp with time zone NOT NULL DEFAULT now(),
      applied_by text NOT NULL DEFAULT current_user,
      memo text
    )
  `);
}

function listMigrationFiles() {
  const dir = migrationsDir();

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter(name => /^\d{8}_\d+_.+\.sql$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "ja"));
}

async function listAppliedMigrations() {
  await ensureMigrationTable();

  const result = await pool.query(`
    SELECT version, name, file_name, checksum_sha256, applied_at, applied_by, memo
    FROM system.schema_migrations
    ORDER BY version
  `);

  return result.rows;
}

async function listMigrationStatus() {
  const files = listMigrationFiles();
  const applied = await listAppliedMigrations();
  const appliedMap = new Map(applied.map(row => [row.version, row]));

  return files.map(fileName => {
    const version = migrationVersionFromFile(fileName);
    const fullPath = path.join(migrationsDir(), fileName);
    const sql = fs.readFileSync(fullPath, "utf8");
    const checksum = checksumSha256(sql);
    const appliedRow = appliedMap.get(version);

    return {
      version,
      name: migrationNameFromVersion(version),
      file_name: fileName,
      checksum_sha256: checksum,
      applied: Boolean(appliedRow),
      applied_at: appliedRow ? appliedRow.applied_at : null,
      checksum_matches: appliedRow ? appliedRow.checksum_sha256 === checksum : null
    };
  });
}

async function applyMigrationFile(fileName) {
  const fullPath = path.join(migrationsDir(), fileName);
  const sql = fs.readFileSync(fullPath, "utf8");
  const version = migrationVersionFromFile(fileName);
  const name = migrationNameFromVersion(version);
  const checksum = checksumSha256(sql);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await ensureMigrationTable(client);

    const already = await client.query(
      "SELECT version, checksum_sha256 FROM system.schema_migrations WHERE version = $1",
      [version]
    );

    if (already.rows.length > 0) {
      await client.query("COMMIT");

      return {
        version,
        file_name: fileName,
        skipped: true,
        reason: "already applied"
      };
    }

    await client.query(sql);

    await client.query(
      `
        INSERT INTO system.schema_migrations
          (version, name, file_name, checksum_sha256, memo)
        VALUES
          ($1, $2, $3, $4, $5)
      `,
      [
        version,
        name,
        fileName,
        checksum,
        version === "20260703_001_baseline_current_schema"
          ? "現在のDB構造をbaselineとして登録"
          : ""
      ]
    );

    await client.query("COMMIT");

    return {
      version,
      file_name: fileName,
      skipped: false,
      applied: true
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function applyPendingMigrations() {
  await ensureMigrationTable();

  const files = listMigrationFiles();
  const results = [];

  for (const fileName of files) {
    results.push(await applyMigrationFile(fileName));
  }

  return results;
}

module.exports = {
  migrationsDir,
  listMigrationFiles,
  listAppliedMigrations,
  listMigrationStatus,
  applyMigrationFile,
  applyPendingMigrations
};
