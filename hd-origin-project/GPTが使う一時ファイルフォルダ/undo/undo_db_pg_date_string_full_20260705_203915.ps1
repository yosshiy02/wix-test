$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\src\db.js"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\db_before_pg_date_string_full_20260705_203915.js"

Copy-Item -LiteralPath $Before -Destination $Target -Force

Write-Host "OK: db.js を修正前に戻しました。"
