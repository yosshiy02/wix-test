$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$Before = Join-Path $TempRoot "before\web_receiver\public\payables\payable-list_before_money_only_20260706_212036.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
Copy-Item -LiteralPath $Before -Destination $Target -Force
Write-Host "OK: money関数だけの安全修正をUNDOしました。"