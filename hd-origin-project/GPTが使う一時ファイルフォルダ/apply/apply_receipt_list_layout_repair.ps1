$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$After = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"

Copy-Item $After $Target -Force

Write-Host "OK: レシート読取確認ページのレイアウト応急復旧を反映しました。"
