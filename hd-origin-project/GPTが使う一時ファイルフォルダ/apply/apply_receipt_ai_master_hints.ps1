$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"

Copy-Item (Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.ai.js") (Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.ai.js") -Force
Copy-Item (Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.repository.js") (Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.repository.js") -Force

Write-Host "反映しました: レシートAI マスタ候補対応"
