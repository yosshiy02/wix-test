$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Src = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-ledger-print.html"
$BeforeFile = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-ledger-print_before_filter_sort_expand.html"
Copy-Item -LiteralPath $BeforeFile -Destination $Src -Force
Write-Host "OK: receipt-ledger-print.html を元に戻しました"
