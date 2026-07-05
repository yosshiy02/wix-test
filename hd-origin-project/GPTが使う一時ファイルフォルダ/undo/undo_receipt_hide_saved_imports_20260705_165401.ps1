$RepoTarget = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.repository.js"
$RouteTarget = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.routes.js"
$BeforeRepo = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.repository_before_hide_saved_imports_20260705_165401.js"
$BeforeRoute = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.routes_before_hide_saved_imports_20260705_165401.js"

Copy-Item -LiteralPath $BeforeRepo -Destination $RepoTarget -Force
Copy-Item -LiteralPath $BeforeRoute -Destination $RouteTarget -Force

Write-Host "OK: 本保存済み通常一覧除外を修正前へ戻しました。"
