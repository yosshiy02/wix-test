$ErrorActionPreference = "Stop"
$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js"
$BeforeFile = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT00_routes_後付け解析システム補完撤去_20260709_101225.before.js"

if (-not (Test-Path -LiteralPath $BeforeFile)) {
  throw "beforeファイルが見つかりません: $BeforeFile"
}

Copy-Item -LiteralPath $BeforeFile -Destination $Target -Force
Write-Host "UNDO完了: 後付け解析システム補完撤去前に戻しました。"
