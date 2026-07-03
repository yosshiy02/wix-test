const path = require("path");

const projectRoot = process.argv[2];
const webDir = path.join(projectRoot, "web_receiver");

const pool = require(path.join(webDir, "src", "db.js"));

async function main() {
  const out = [];

  out.push("DBマイグレーション土台 途中停止後確認");
  out.push("==============================");

  async function q(title, sql) {
    out.push("");
    out.push("[" + title + "]");
    try {
      const r = await pool.query(sql);
      out.push(JSON.stringify(r.rows, null, 2));
    } catch (err) {
      out.push("ERROR: " + err.message);
    }
  }

  await q("system スキーマ確認", `
    select schema_name
    from information_schema.schemata
    where schema_name = 'system'
  `);

  await q("schema_migrations テーブル確認", `
    select table_schema, table_name
    from information_schema.tables
    where table_schema = 'system'
      and table_name = 'schema_migrations'
  `);

  await q("schema_migrations 内容確認", `
    select version, name, file_name, applied_at, applied_by, memo
    from system.schema_migrations
    order by version
  `);

  console.log(out.join("\n"));
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
