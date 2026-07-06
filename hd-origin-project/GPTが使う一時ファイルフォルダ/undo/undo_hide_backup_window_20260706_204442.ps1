$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$Before = Join-Path $TempRoot "before\web_receiver\public\hd-origin-exit-guard_before_hide_backup_window_20260706_204442.js"
$Target = Join-Path $ProjectRoot "web_receiver\public\hd-origin-exit-guard.js"
Copy-Item -LiteralPath $Before -Destination $Target -Force
Write-Host "OK: 右下バックアップウインドウ非表示をUNDOしました。"