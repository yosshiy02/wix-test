$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_saved_list_button_20260705_195701.html"

Copy-Item -LiteralPath $Before -Destination $Target -Force

Write-Host "OK: receipt-list.html を修正前に戻しました。"
