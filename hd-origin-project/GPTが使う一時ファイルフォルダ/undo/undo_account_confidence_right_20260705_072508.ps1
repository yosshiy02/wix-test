$CssPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.css"
$BeforeCss = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_account_confidence_right_20260705_072508.css"

if (-not (Test-Path -LiteralPath $BeforeCss)) {
  throw "before CSS not found: $BeforeCss"
}

Copy-Item -LiteralPath $BeforeCss -Destination $CssPath -Force

Write-Host "OK: restored receipt-list.css"