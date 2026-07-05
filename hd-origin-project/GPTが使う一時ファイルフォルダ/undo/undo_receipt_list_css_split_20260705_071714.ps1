$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$BeforeHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_css_split_20260705_071714.html"
$DestHtml   = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"
$DestCss    = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.css"

if (-not (Test-Path -LiteralPath $BeforeHtml)) { throw "before HTML がありません: $BeforeHtml" }

Copy-Item -LiteralPath $BeforeHtml -Destination $DestHtml -Force

if (Test-Path -LiteralPath $DestCss) {
  Remove-Item -LiteralPath $DestCss -Force
}

Write-Host "OK: CSS分離前に戻しました。元々 receipt-list.css は無かったため削除しました。"