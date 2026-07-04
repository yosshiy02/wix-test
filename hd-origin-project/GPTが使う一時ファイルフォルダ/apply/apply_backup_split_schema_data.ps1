$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Source = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\src\backups\backup.service.js"
$Target = Join-Path $ProjectRoot "web_receiver\src\backups\backup.service.js"
Copy-Item -Path $Source -Destination $Target -Force
Write-Host "APPLY OK: backup.service.js を構造/データ分離バックアップ版に反映しました。"
