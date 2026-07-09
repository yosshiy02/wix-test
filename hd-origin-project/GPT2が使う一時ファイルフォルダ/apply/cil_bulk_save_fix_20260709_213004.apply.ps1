$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$AfterDir = Join-Path $TempRoot "after"

Copy-Item -LiteralPath (Join-Path $AfterDir "web_receiver\public\payables\payment-document-specialist-contract-insurance-lease.html") -Destination (Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-specialist-contract-insurance-lease.html") -Force

Write-Host "OK: 契約・保険・リース まとめて保存ID/エラー表示補強を反映しました。"
