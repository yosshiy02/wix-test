$ErrorActionPreference = "Stop"

$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-contract-insurance-lease.html"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_契約保険リース_ai_specialist_context_body_detect_20260709_080649.before.html"

Copy-Item -LiteralPath $Before -Destination $Target -Force

Write-Host "OK: 契約・保険・リース専門HTMLを修正前に戻しました。"
Write-Host $Target
