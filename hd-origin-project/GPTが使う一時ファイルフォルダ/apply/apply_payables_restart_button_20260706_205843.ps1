$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$After = Join-Path $TempRoot "after\web_receiver\public\payables\payable-list_after_restart_button_20260706_205843.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
Copy-Item -LiteralPath $After -Destination $Target -Force
Write-Host "OK: 請求書・未払管理にサーバー再起動ボタンを再反映しました。"