const fs = require("fs");

const backupServicePath = process.argv[2];
const dbPath = process.argv[3];
const sqlPath = process.argv[4];

async function main() {
  try {
    const backupService = require(backupServicePath);

    if (backupService && typeof backupService.createBackup === "function") {
      const backup = await backupService.createBackup("before_all_master_internal_codes");
      console.log("[BACKUP_OK]");
      console.log(JSON.stringify(backup, null, 2));
    } else {
      console.log("[BACKUP_SKIP] createBackup が見つかりません。");
    }
  } catch (error) {
    console.log("[BACKUP_WARN] DBバックアップは作成できませんでした。マイグレーションはトランザクションで実行します。");
    console.log(error.message || String(error));
  }

  const pool = require(dbPath);
  const sql = fs.readFileSync(sqlPath, "utf8");

  try {
    await pool.query(sql);
    console.log("[MIGRATION_OK] " + sqlPath);
  } finally {
    if (pool && typeof pool.end === "function") {
      await pool.end();
    }
  }
}

main().catch(error => {
  console.error("[MIGRATION_ERROR]");
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});