$HtmlPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"
$BeforeHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_fix_old_master_display_call_20260705_075907.html"

if (-not (Test-Path -LiteralPath $BeforeHtml)) {
  throw "before HTML not found: $BeforeHtml"
}

Copy-Item -LiteralPath $BeforeHtml -Destination $HtmlPath -Force

Write-Host "OK: restored receipt-list.html"