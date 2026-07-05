$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"

Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.repository_before_saved_ledger_20260705_200613.js" -Destination (Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.repository.js") -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.routes_before_saved_ledger_20260705_200613.js" -Destination (Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.routes.js") -Force

$HtmlTarget = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-saved-list.html"
Remove-Item -LiteralPath $HtmlTarget -Force -ErrorAction SilentlyContinue

Write-Host "OK: レシート台帳修正を戻しました。"
