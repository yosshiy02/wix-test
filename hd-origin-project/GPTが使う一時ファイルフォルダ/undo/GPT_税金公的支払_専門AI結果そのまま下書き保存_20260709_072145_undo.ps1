cd "G:\GITHUB\wix-test\hd-origin-project"
$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-specialist-tax-public.html"
$Dst = Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-specialist-tax-public.html"

Copy-Item -LiteralPath $Before -Destination $Dst -Force

Write-Host "OK: 税金・公的支払専門AI結果保存修正をUNDOしました。"
