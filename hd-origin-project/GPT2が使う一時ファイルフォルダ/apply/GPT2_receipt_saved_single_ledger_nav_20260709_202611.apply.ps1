$ErrorActionPreference = "Stop"

$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$AfterDir = Join-Path $TempRoot "after"

Copy-Item -LiteralPath (Join-Path $AfterDir "GPT2_receipt_saved_list_nav_20260709_202611.after.html") -Destination (Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-saved-list.html") -Force
Copy-Item -LiteralPath (Join-Path $AfterDir "GPT2_receipt_ledger_print_nav_20260709_202611.after.html") -Destination (Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-ledger-print.html") -Force

Write-Host "OK: レシート台帳 単票・帳票に他ページ導線ボタンを反映しました。"
