$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\src\config.js"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\config_before_receipt_dropbox_root_regex_20260705_193237.js"

Copy-Item -LiteralPath $Before -Destination $Target -Force

Write-Host "OK: config.js を修正前に戻しました。"
