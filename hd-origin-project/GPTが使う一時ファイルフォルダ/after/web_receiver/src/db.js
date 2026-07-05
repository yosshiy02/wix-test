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

module.exports = pool;
