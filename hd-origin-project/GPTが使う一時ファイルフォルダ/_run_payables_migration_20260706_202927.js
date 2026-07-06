const fs = require("fs");
const path = require("path");
async function main() {
  const projectRoot = process.argv[2];
  const sqlPath = process.argv[3];
  process.chdir(path.join(projectRoot, "web_receiver"));
  require(path.join(projectRoot, "web_receiver", "src", "config"));
  const db = require(path.join(projectRoot, "web_receiver", "src", "db"));
  const sql = fs.readFileSync(sqlPath, "utf8");
  async function query(text, params) {
    if (db && typeof db.query === "function") return db.query(text, params);
    if (db && db.pool && typeof db.pool.query === "function") return db.pool.query(text, params);
    throw new Error("db.query が見つかりません。");
  }
  await query(sql);
  if (db && db.pool && typeof db.pool.end === "function") {
    await db.pool.end();
  } else if (db && typeof db.end === "function") {
    await db.end();
  }
  console.log(JSON.stringify({ ok: true, migration: sqlPath }, null, 2));
}
main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
