$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Before = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_remove_settled_payload_20260705.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"

Copy-Item -LiteralPath $Before -Destination $Target -Force
Write-Host "UNDO完了: receipt-list.html を payload除去前へ戻しました。"
