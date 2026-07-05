$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Src = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-saved-list.html"
$AfterFile = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-saved-list.html"
Copy-Item -LiteralPath $AfterFile -Destination $Src -Force
Write-Host "OK: receipt-saved-list.html へ反映しました"
