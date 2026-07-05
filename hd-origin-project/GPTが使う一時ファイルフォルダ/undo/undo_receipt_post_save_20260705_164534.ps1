$RepoTarget = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.repository.js"
$RouteTarget = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.routes.js"
$HtmlTarget = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"

$BeforeRepo = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.repository_before_post_save_20260705_164534.js"
$BeforeRoute = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.routes_before_post_save_20260705_164534.js"
$BeforeHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_post_save_20260705_164534.html"

Copy-Item -LiteralPath $BeforeRepo -Destination $RepoTarget -Force
Copy-Item -LiteralPath $BeforeRoute -Destination $RouteTarget -Force
Copy-Item -LiteralPath $BeforeHtml -Destination $HtmlTarget -Force

Write-Host "OK: レシート本保存API・まとめて保存接続を修正前へ戻しました。"
