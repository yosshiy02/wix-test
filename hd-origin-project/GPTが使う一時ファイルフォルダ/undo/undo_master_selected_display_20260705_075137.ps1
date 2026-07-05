$HtmlPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"
$CssPath  = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.css"
$BeforeHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_master_selected_display_20260705_075137.html"
$BeforeCss  = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_master_selected_display_20260705_075137.css"

if (-not (Test-Path -LiteralPath $BeforeHtml)) {
  throw "before HTML not found: $BeforeHtml"
}
if (-not (Test-Path -LiteralPath $BeforeCss)) {
  throw "before CSS not found: $BeforeCss"
}

Copy-Item -LiteralPath $BeforeHtml -Destination $HtmlPath -Force
Copy-Item -LiteralPath $BeforeCss  -Destination $CssPath  -Force

Write-Host "OK: restored receipt-list.html and receipt-list.css"