$ErrorActionPreference = "Stop"
$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html"
$BeforeFile = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT00_仕分け表示ボタン_DB最新情報対応_20260709_094708.before.html"

if (-not (Test-Path -LiteralPath $BeforeFile)) {
  throw "beforeファイルが見つかりません: $BeforeFile"
}

Copy-Item -LiteralPath $BeforeFile -Destination $Target -Force
Write-Host "UNDO完了: 表示ボタンDB最新情報対応を修正前に戻しました。"
