$Source = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.html"
$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"

Copy-Item -LiteralPath $Source -Destination $Target -Force
Write-Host "反映しました: $Target"
