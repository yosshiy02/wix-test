const { Client } = require("pg");
const config = require("./config");

function connection(database) {
  return {
    host: config.db.host,
    port: config.db.port,
    database,
    user: config.db.user,
    password: String(config.db.password || "")
  };
}

async function withClient(database, fn) {
  const client = new Client(connection(database));
  await client.connect();

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function databaseExists(dbName) {
  return await withClient("postgres", async client => {
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    return result.rowCount > 0;
  });
}

async function ensureDatabaseReady() {
  const dbName = config.db.database;

  if (!dbName) {
    throw new Error("DB_NAME が .env にありません。");
  }

  if (!await databaseExists(dbName)) {
    throw new Error(
      `[DB] database not found: ${dbName}. Create the database manually before starting the application.`
    );
  }

  await withClient(dbName, async client => {
    await client.query("SELECT 1");
  });

  console.log(`[DB] ready: ${dbName}`);
}

module.exports = {
  ensureDatabaseReady
};