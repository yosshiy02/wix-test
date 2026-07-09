$ErrorActionPreference = "Stop"

$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-specialist-contract-insurance-lease.html"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_契約保険リース_単独保存専門下書き連動_関数検出_20260708_235326.before.html"

if (-not (Test-Path -LiteralPath $Target)) {
    throw "対象HTMLが見つかりません: $Target"
}

if (-not (Test-Path -LiteralPath $Before)) {
    throw "beforeファイルが見つかりません: $Before"
}

Copy-Item -LiteralPath $Before -Destination $Target -Force

Write-Host "OK: 契約・保険・リース専門HTMLを修正前に戻しました。"
Write-Host $Target
