$HtmlPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"
$CssPath  = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.css"
$BeforeHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_line_count_badge_safe_20260705_081414.html"
$BeforeCss  = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_line_count_badge_safe_20260705_081414.css"

Copy-Item -LiteralPath $BeforeHtml -Destination $HtmlPath -Force
Copy-Item -LiteralPath $BeforeCss  -Destination $CssPath  -Force

Write-Host "OK: restored receipt-list.html and receipt-list.css"