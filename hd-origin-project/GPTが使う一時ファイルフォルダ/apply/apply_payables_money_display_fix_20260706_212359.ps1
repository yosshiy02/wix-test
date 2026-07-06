$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$After = Join-Path $TempRoot "after\web_receiver\public\payables\payable-list_after_money_display_fix_20260706_212359.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
Copy-Item -LiteralPath $After -Destination $Target -Force
Write-Host "OK: 請求書・未払管理の金額表示money修正を再反映しました。"