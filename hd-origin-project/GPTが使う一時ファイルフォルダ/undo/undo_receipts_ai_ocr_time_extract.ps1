$ErrorActionPreference = "Stop"
$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.ai.js"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.ai_before_ocr_time_extract.js"
if (!(Test-Path -LiteralPath $Before)) { throw "beforeファイルが見つかりません: $Before" }
Copy-Item -LiteralPath $Before -Destination $Target -Force
Write-Host "UNDO完了: OCR本文からの時刻機械抽出修正前へ戻しました。"
