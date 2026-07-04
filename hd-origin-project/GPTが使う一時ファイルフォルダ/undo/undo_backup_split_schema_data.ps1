$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Source = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\backups\backup.service_before_split_schema_data.js"
$Target = Join-Path $ProjectRoot "web_receiver\src\backups\backup.service.js"
Copy-Item -Path $Source -Destination $Target -Force
Write-Host "UNDO OK: backup.service.js を修正前に戻しました。"
