Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue
$ErrorActionPreference = "Stop"
$BeforeHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\payable-list_before_remove_fake_delivery_note_buttons_20260707_002524.html"
$PayableHtmlPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payable-list.html"
if (-not (Test-Path -LiteralPath $BeforeHtml)) {
  throw "before HTML が見つかりません: $BeforeHtml"
}
Copy-Item -LiteralPath $BeforeHtml -Destination $PayableHtmlPath -Force
Write-Host "OK: 偽物納品書ボタン削除前に戻しました。"
