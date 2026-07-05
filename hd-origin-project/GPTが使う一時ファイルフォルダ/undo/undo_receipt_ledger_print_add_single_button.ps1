$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Src = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-ledger-print.html"
$BeforeFile = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-ledger-print_before_single_button.html"
Copy-Item -LiteralPath $BeforeFile -Destination $Src -Force
Write-Host "OK: 単票形式ボタン追加を元に戻しました"
