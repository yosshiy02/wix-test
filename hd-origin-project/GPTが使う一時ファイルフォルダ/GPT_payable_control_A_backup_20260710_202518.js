const path = require("path");

(async () => {
  const projectRoot = "C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project";

  const service = require(
    path.join(
      projectRoot,
      "web_receiver",
      "src",
      "backups",
      "backup.service"
    )
  );

  const result = await service.createBackup(
    "hd_origin_project_before_payable_control_A"
  );

  console.log(JSON.stringify(result, null, 2));
})().catch(error => {
  console.error(error);
  process.exit(1);
});