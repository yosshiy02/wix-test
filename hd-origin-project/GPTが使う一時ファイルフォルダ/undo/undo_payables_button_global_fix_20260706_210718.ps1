$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$Before = Join-Path $TempRoot "before\web_receiver\public\payables\payable-list_before_button_global_fix_20260706_210718.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
Copy-Item -LiteralPath $Before -Destination $Target -Force
Write-Host "OK: 請求書・未払管理のボタン関数global修正をUNDOしました。"