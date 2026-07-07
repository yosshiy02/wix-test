# ==============================
# UNDO メインメニュー入金管理ボタン正式追加
# ==============================

$ErrorActionPreference = "Stop"

$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\index.html"
$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\index.html"

if (-not (Test-Path -LiteralPath $Before)) {
  throw "beforeファイルが見つかりません: $Before"
}

Copy-Item -LiteralPath $Before -Destination $Target -Force

Write-Host "OK: index.html を修正前に戻しました。"