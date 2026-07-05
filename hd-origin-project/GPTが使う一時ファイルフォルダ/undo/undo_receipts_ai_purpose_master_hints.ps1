$ErrorActionPreference = "Stop"
$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.ai.js"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.ai_before_purpose_ai_master_hints.js"
if (!(Test-Path -LiteralPath $Before)) { throw "beforeファイルが見つかりません: $Before" }
Copy-Item -LiteralPath $Before -Destination $Target -Force
Write-Host "UNDO完了: receipts.ai.js を修正前へ戻しました。"
