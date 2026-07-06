Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue
$ErrorActionPreference = "Stop"
$BeforeHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\delivery-note-inbox_before_image_zoom_20260707_003048.html"
$HtmlPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\delivery-notes\delivery-note-inbox.html"
if (-not (Test-Path -LiteralPath $BeforeHtml)) {
  throw "before HTML が見つかりません: $BeforeHtml"
}
Copy-Item -LiteralPath $BeforeHtml -Destination $HtmlPath -Force
Write-Host "OK: 納品書画像拡大縮小修正前に戻しました。"
