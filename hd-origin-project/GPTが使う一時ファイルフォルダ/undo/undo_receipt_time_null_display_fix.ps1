$ErrorActionPreference = "Stop"
$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_receipt_time_null_display_fix.html"
if (!(Test-Path -LiteralPath $Before)) { throw "beforeファイルが見つかりません: $Before" }
Copy-Item -LiteralPath $Before -Destination $Target -Force
Write-Host "UNDO完了: レシート時刻NULL表示修正前へ戻しました。"
