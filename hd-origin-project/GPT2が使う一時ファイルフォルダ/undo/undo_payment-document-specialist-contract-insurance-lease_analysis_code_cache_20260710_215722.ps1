$ErrorActionPreference = "Stop"

$Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-contract-insurance-lease.html"
$Before = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\payment-document-specialist-contract-insurance-lease.before_analysis_code_cache_20260710_215722.html"

if (-not (Test-Path -LiteralPath $Before)) {
    throw "before file not found."
}

Copy-Item -LiteralPath $Before -Destination $Target -Force

Write-Host "UNDO OK"
Write-Host $Target