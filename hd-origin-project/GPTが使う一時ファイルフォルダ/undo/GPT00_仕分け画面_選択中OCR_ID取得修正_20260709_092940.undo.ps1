$ErrorActionPreference = "Stop"
$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html"
$BeforeFile = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT00_仕分け画面_選択中OCR_ID取得修正_20260709_092940.before.html"

if (-not (Test-Path -LiteralPath $BeforeFile)) {
  throw "beforeファイルが見つかりません: $BeforeFile"
}

Copy-Item -LiteralPath $BeforeFile -Destination $Target -Force
Write-Host "UNDO完了: 仕分け画面を修正前に戻しました。"
