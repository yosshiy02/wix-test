# ==============================
# UNDO 入金管理入口骨格
# ==============================

$ErrorActionPreference = "Stop"

$MainBefore = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\index.html"
$MainTarget = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\index.html"
$ReceivableTarget = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receivables\receivable-dashboard.html"

if (-not (Test-Path -LiteralPath $MainBefore)) {
  throw "メイン画面beforeが見つかりません: $MainBefore"
}

Copy-Item -LiteralPath $MainBefore -Destination $MainTarget -Force

if (Test-Path -LiteralPath $ReceivableTarget) {
  Remove-Item -LiteralPath $ReceivableTarget -Force
}

Write-Host "OK: メイン画面を戻し、入金管理画面を削除しました。"