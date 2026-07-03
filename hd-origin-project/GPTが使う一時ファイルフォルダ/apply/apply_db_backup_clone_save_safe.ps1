$ErrorActionPreference = "Stop"

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\config.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\config.js" -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\backups\backup.service.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\backups\backup.service.js" -Force

$NodeExe = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path -LiteralPath $NodeExe)) {
  $NodeExe = "node"
}

& $NodeExe --check "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\config.js"
if ($LASTEXITCODE -ne 0) {
  Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\config_before_backup_clone_dir_safe.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\config.js" -Force
  Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\backups\backup.service_before_clone_save_safe.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\backups\backup.service.js" -Force
  throw "config.js 反映後チェック失敗。beforeから戻しました。"
}

& $NodeExe --check "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\backups\backup.service.js"
if ($LASTEXITCODE -ne 0) {
  Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\config_before_backup_clone_dir_safe.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\config.js" -Force
  Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\backups\backup.service_before_clone_save_safe.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\backups\backup.service.js" -Force
  throw "backup.service.js 反映後チェック失敗。beforeから戻しました。"
}

Write-Host "DBバックアップの2か所保存処理を反映しました。"
