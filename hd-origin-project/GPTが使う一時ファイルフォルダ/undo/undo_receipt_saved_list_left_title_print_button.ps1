$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Src = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-saved-list.html"
$BeforeFile = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-saved-list_before_left_title_print_button.html"
Copy-Item -LiteralPath $BeforeFile -Destination $Src -Force
Write-Host "OK: receipt-saved-list.html を元に戻しました"
