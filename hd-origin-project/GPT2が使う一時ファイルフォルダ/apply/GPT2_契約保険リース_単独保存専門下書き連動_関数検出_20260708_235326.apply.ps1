$ErrorActionPreference = "Stop"

$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-specialist-contract-insurance-lease.html"
$After = "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\after\GPT2_契約保険リース_単独保存専門下書き連動_関数検出_20260708_235326.after.html"

if (-not (Test-Path -LiteralPath $Target)) {
    throw "対象HTMLが見つかりません: $Target"
}

if (-not (Test-Path -LiteralPath $After)) {
    throw "afterファイルが見つかりません: $After"
}

Copy-Item -LiteralPath $After -Destination $Target -Force

Write-Host "OK: 契約・保険・リース専門HTMLへ反映しました。"
Write-Host $Target
