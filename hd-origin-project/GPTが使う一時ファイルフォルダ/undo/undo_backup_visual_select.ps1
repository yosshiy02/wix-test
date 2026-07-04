$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Source = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\public\settings_before_backup_visual_select.js.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\settings.html"
Copy-Item -Path $Source -Destination $Target -Force
Write-Host "UNDO OK: settings.html を修正前に戻しました。"
