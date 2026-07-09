$ErrorActionPreference = "Stop"

$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$BeforeDir = Join-Path $TempRoot "before"

Copy-Item -LiteralPath (Join-Path $BeforeDir "GPT2_receipt_saved_list_nav_20260709_202611.before.html") -Destination (Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-saved-list.html") -Force
Copy-Item -LiteralPath (Join-Path $BeforeDir "GPT2_receipt_ledger_print_nav_20260709_202611.before.html") -Destination (Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-ledger-print.html") -Force

Write-Host "OK: レシート台帳 単票・帳票を修正前へ戻しました。"
