$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$IndexPath = Join-Path $ProjectRoot "web_receiver\public\index.html"
$PayablesDir = Join-Path $ProjectRoot "web_receiver\public\payables"
$PayablesPath = Join-Path $PayablesDir "payable-list.html"
$AfterIndexPath = Join-Path $TempRoot "after\web_receiver\public\index_after_payables_button_20260706_202133.html"
$AfterPayablesPath = Join-Path $TempRoot "after\web_receiver\public\payables\payable-list_after_create_20260706_202133.html"
Copy-Item -LiteralPath $AfterIndexPath -Destination $IndexPath -Force
New-Item -ItemType Directory -Force -Path $PayablesDir | Out-Null
Copy-Item -LiteralPath $AfterPayablesPath -Destination $PayablesPath -Force
Write-Host "OK: 請求書・未払管理ボタンを再反映しました。"
