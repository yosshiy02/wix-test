Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue
$ErrorActionPreference = "Stop"
$BeforePayableHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\payable-list_before_delivery_note_page_link_20260707_002118.html"
$BeforeDeliveryHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\delivery-note-inbox_before_20260707_002118.html"
$PayableHtmlPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payable-list.html"
$DeliveryHtmlPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\delivery-notes\delivery-note-inbox.html"
Copy-Item -LiteralPath $BeforePayableHtml -Destination $PayableHtmlPath -Force
if ((Test-Path -LiteralPath $BeforeDeliveryHtml) -and ((Get-Item -LiteralPath $BeforeDeliveryHtml).Length -gt 0)) {
  Copy-Item -LiteralPath $BeforeDeliveryHtml -Destination $DeliveryHtmlPath -Force
} else {
  if (Test-Path -LiteralPath $DeliveryHtmlPath) {
    Remove-Item -LiteralPath $DeliveryHtmlPath -Force
  }
}
$BeforePayableCss = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\payable-list_before_delivery_note_page_link_20260707_002118.css"
$PayableCssPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payable-list.css"
if (Test-Path -LiteralPath $BeforePayableCss) {
  Copy-Item -LiteralPath $BeforePayableCss -Destination $PayableCssPath -Force
}
Write-Host "OK: 納品書ページ土台作成前に戻しました。"
