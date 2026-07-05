$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Src = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-ledger-print.html"
$BeforeFile = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-ledger-print_before_font_up.html"
Copy-Item -LiteralPath $BeforeFile -Destination $Src -Force
Write-Host "OK: 帳票ページの文字サイズを元に戻しました"
