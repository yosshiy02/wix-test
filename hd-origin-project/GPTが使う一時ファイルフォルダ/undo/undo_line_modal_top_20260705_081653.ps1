$CssPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.css"
$BeforeCss = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_line_modal_top_20260705_081653.css"

if (-not (Test-Path -LiteralPath $BeforeCss)) {
  throw "before CSS not found: $BeforeCss"
}

Copy-Item -LiteralPath $BeforeCss -Destination $CssPath -Force

Write-Host "OK: restored receipt-list.css"