$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-saved-list.html"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-saved-list_before_restart_button_20260705_200921.html"

Copy-Item -LiteralPath $Before -Destination $Target -Force

Write-Host "OK: receipt-saved-list.html を修正前に戻しました。"
