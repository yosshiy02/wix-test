$RepoPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.repository.js"
$HtmlPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"

$BeforeRepo = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.repository_before_account_titles_master_options_20260705_085301.js"
$BeforeHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_account_titles_master_options_20260705_085301.html"

if (-not (Test-Path -LiteralPath $BeforeRepo)) { throw "before repo not found: $BeforeRepo" }
if (-not (Test-Path -LiteralPath $BeforeHtml)) { throw "before html not found: $BeforeHtml" }

Copy-Item -LiteralPath $BeforeRepo -Destination $RepoPath -Force
Copy-Item -LiteralPath $BeforeHtml -Destination $HtmlPath -Force

Write-Host "OK: restored receipts.repository.js and receipt-list.html"