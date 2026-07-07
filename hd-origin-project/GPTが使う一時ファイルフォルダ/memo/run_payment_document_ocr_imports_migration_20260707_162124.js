const fs = require("fs");
const path = require("path");
const db = require(path.join("C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project", "web_receiver", "src", "db"));

async function main() {
  const sql = fs.readFileSync("C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project\\database\\migrations\\20260707_005_payment_document_ocr_imports.sql", "utf8");
  await db.query(sql);
  console.log("OK: payment_document_ocr_imports migration applied");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });