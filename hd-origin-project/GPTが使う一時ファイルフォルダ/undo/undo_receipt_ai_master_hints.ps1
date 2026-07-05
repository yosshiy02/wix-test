$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"

Copy-Item (Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.ai_before_master_hints.js") (Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.ai.js") -Force
Copy-Item (Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.repository_before_ai_master_hints_save.js") (Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.repository.js") -Force

Write-Host "UNDOしました: レシートAI マスタ候補対応"
