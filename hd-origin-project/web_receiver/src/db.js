const { Pool, types } = require("pg");
const config = require("./config");

/*
  PostgreSQL DATE 型は、会計上の「取引日」として扱う。
  JS Date に変換すると UTC / ローカル時差で前日表示になる可能性があるため、
  DATE 型は YYYY-MM-DD の文字列のまま受け取る。

  OID 1082 = date
*/
types.setTypeParser(1082, (value) => value);

const pool = new Pool(config.db);
/* GPT00_DB_POOL_RESTORE_ERROR_GUARD_20260711_START */
pool.on("error", err => {
  const code = String(err && err.code ? err.code : "");
  const message = String(
    err && err.message
      ? err.message
      : err || ""
  );

  const isExpectedRestoreDisconnect =
    process.env.HD_ORIGIN_DB_RECREATE_IN_PROGRESS === "1" &&
    (
      code === "57P01" ||
      code === "ECONNRESET" ||
      message.includes("terminating connection due to administrator command") ||
      message.includes("Connection terminated") ||
      message.includes("read ECONNRESET")
    );

  if (isExpectedRestoreDisconnect) {
    console.warn(
      "[RESTORE_DB_RECREATE] DB再作成中のPool接続切断を無視しました:",
      code || "NO_CODE",
      message
    );
    return;
  }

  console.error("[DB_POOL_ERROR]", err);
});
/* GPT00_DB_POOL_RESTORE_ERROR_GUARD_20260711_END */

module.exports = pool;

