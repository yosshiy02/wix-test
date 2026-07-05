$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.repository.js"
$After = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.repository.js"

Copy-Item $After $Target -Force

Write-Host "反映しました: $Target"
