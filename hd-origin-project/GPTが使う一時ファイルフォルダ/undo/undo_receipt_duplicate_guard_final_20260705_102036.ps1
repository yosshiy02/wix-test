$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_duplicate_guard_final_20260705_102036.html"

Copy-Item -LiteralPath $Before -Destination $Target -Force

Write-Host "OK: receipt-list.html を修正前に戻しました。"
