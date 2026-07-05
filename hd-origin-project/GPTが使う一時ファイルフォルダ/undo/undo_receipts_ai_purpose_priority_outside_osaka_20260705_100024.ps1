$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.ai.js"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.ai_before_purpose_priority_outside_osaka_20260705_100024.js"

Copy-Item -LiteralPath $Before -Destination $Target -Force

Write-Host "OK: receipts.ai.js を修正前に戻しました。"
