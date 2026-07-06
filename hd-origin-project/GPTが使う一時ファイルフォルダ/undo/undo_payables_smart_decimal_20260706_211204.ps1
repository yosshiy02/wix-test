$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$Before = Join-Path $TempRoot "before\web_receiver\public\payables\payable-list_before_smart_decimal_20260706_211204.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
Copy-Item -LiteralPath $Before -Destination $Target -Force
Write-Host "OK: 請求書・未払管理の数値表示修正をUNDOしました。"