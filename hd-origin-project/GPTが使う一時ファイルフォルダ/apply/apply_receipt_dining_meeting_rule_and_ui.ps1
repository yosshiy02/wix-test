$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"

Copy-Item (Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.ai.js") (Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.ai.js") -Force
Copy-Item (Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.html") (Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html") -Force

Write-Host "反映しました: レシートAI 飲食代・会議費候補ルール / UI要確認表示"
