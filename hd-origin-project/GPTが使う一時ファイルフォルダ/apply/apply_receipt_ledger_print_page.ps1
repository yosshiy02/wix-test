$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Src = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-ledger-print.html"
$AfterFile = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-ledger-print.html"
Copy-Item -LiteralPath $AfterFile -Destination $Src -Force
Write-Host "OK: receipt-ledger-print.html を反映しました"
