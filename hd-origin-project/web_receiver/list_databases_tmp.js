const { Pool } = require("pg");

const pool = new Pool({
  host: "127.0.0.1",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: String(process.env.DB_PASSWORD || "")
});

(async () => {
  const r = await pool.query(`
    SELECT datname
    FROM pg_database
    WHERE datistemplate = false
    ORDER BY datname
  `);

  console.log("");
  console.log("=== PostgreSQL データベース一覧 ===");
  console.table(r.rows);

  await pool.end();
})().catch(async err => {
  console.error(err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
