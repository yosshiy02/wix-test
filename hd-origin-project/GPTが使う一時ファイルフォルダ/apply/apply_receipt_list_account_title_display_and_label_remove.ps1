$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"
$After = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.html"

Copy-Item $After $Target -Force

Write-Host "反映しました: $Target"
