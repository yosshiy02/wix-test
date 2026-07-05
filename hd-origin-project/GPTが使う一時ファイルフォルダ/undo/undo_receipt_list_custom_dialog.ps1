$ErrorActionPreference = "Stop"
$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_custom_dialog.html"
if (!(Test-Path -LiteralPath $Before)) { throw "beforeファイルが見つかりません: $Before" }
Copy-Item -LiteralPath $Before -Destination $Target -Force
Write-Host "UNDO完了: receipt-list.html を修正前へ戻しました。"
