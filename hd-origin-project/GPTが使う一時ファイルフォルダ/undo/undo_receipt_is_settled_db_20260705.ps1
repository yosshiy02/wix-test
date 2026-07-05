$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"

$BeforeHtml = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_is_settled_db_20260705.html"
$BeforeRepo = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.repository_before_is_settled_db_20260705.js"
$BeforeRoutes = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.routes_before_is_settled_db_20260705.js"

$HtmlTarget = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"
$RepoTarget = Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.repository.js"
$RoutesTarget = Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.routes.js"

Copy-Item -LiteralPath $BeforeHtml -Destination $HtmlTarget -Force
Copy-Item -LiteralPath $BeforeRepo -Destination $RepoTarget -Force
Copy-Item -LiteralPath $BeforeRoutes -Destination $RoutesTarget -Force

Write-Host "UNDO完了: HTML / repository / routes を is_settled 対応前へ戻しました。"
Write-Host "注意: DBの is_settled カラムは安全のため削除しません。"
