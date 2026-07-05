$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Before = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_settled_checkbox_v2_20260705.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"

Copy-Item -LiteralPath $Before -Destination $Target -Force
Write-Host "UNDO完了: receipt-list.html を清算済みチェック追加前へ戻しました。"
