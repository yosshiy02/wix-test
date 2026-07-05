$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"

Copy-Item (Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.ai_before_dining_meeting_rule.js") (Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.ai.js") -Force
Copy-Item (Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_dining_review_ui.html") (Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html") -Force

Write-Host "UNDOしました: レシートAI 飲食代・会議費候補ルール / UI要確認表示"
