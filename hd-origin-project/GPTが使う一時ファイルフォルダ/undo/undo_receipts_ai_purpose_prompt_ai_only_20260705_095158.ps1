$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.ai.js"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.ai_before_purpose_prompt_ai_only_20260705_095158.js"

Copy-Item -LiteralPath $Before -Destination $Target -Force

Write-Host "OK: receipts.ai.js を修正前に戻しました。"
