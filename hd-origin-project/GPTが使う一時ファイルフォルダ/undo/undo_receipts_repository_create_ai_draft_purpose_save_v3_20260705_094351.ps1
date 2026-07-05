$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.repository.js"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.repository_before_create_ai_draft_purpose_save_v3_20260705_094351.js"

Copy-Item -LiteralPath $Before -Destination $Target -Force

Write-Host "OK: receipts.repository.js を修正前に戻しました。"
