const path = require("path");
async function main() {
  const projectRoot = process.argv[2];
  process.chdir(path.join(projectRoot, "web_receiver"));
  require(path.join(projectRoot, "web_receiver", "src", "config"));
  const db = require(path.join(projectRoot, "web_receiver", "src", "db"));
  async function query(sql, params) {
    if (db && typeof db.query === "function") return db.query(sql, params);
    if (db && db.pool && typeof db.pool.query === "function") return db.pool.query(sql, params);
    throw new Error("db.query が見つかりません。");
  }
  const result = await query(`
    SELECT
      to_regclass('accounting.payable_documents') AS payable_documents,
      to_regclass('accounting.payable_lines') AS payable_lines,
      to_regclass('accounting.payable_payments') AS payable_payments,
      to_regclass('accounting.payable_status_history') AS payable_status_history,
      to_regclass('accounting.v_payable_documents') AS v_payable_documents
  `);
  if (db && db.pool && typeof db.pool.end === "function") {
    await db.pool.end();
  } else if (db && typeof db.end === "function") {
    await db.end();
  }
  console.log(JSON.stringify({ ok: true, db: result.rows[0] }, null, 2));
}
main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
