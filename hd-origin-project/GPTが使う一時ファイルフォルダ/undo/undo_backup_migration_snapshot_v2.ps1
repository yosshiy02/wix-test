$ErrorActionPreference = "Stop"

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\migrations\migration.service_before_bom_fix_v2.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\migrations\migration.service.js" -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\backups\backup.service_before_migration_snapshot_v2.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\backups\backup.service.js" -Force

$NodeExe = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path -LiteralPath $NodeExe)) {
  $NodeExe = "node"
}

& $NodeExe --check "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\migrations\migration.service.js"
if ($LASTEXITCODE -ne 0) {
  throw "UNDO後 migration.service.js の構文チェックに失敗しました。"
}

& $NodeExe --check "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\backups\backup.service.js"
if ($LASTEXITCODE -ne 0) {
  throw "UNDO後 backup.service.js の構文チェックに失敗しました。"
}

Write-Host "DBバックアップ migration_snapshot 修正を元に戻しました。"
