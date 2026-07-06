const path = require("path");
async function main() {
  const projectRoot = process.argv[2];
  const stamp = process.argv[3];
  process.chdir(path.join(projectRoot, "web_receiver"));
  require(path.join(projectRoot, "web_receiver", "src", "config"));
  const { createBackup } = require(path.join(projectRoot, "web_receiver", "src", "backups", "backup.service"));
  const result = await createBackup("before_payables_system_" + stamp);
  console.log(JSON.stringify({ ok: true, backup: result }, null, 2));
}
main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
