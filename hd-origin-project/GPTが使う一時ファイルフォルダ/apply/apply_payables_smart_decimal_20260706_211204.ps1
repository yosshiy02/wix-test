$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$After = Join-Path $TempRoot "after\web_receiver\public\payables\payable-list_after_smart_decimal_20260706_211204.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
Copy-Item -LiteralPath $After -Destination $Target -Force
Write-Host "OK: 請求書・未払管理の数値表示修正を再反映しました。"