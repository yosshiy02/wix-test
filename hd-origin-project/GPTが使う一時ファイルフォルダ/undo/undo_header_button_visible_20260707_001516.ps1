Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue
$ErrorActionPreference = "Stop"
$BeforeCss = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\payable-list_before_header_button_visible_20260707_001516.css"
$CssPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payable-list.css"
if (-not (Test-Path -LiteralPath $BeforeCss)) {
  throw "before CSS が見つかりません: $BeforeCss"
}
Copy-Item -LiteralPath $BeforeCss -Destination $CssPath -Force
Write-Host "OK: ヘッダーボタン色修正前に戻しました。"
