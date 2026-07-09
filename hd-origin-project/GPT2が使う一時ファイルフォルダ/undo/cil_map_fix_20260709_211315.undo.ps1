$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\cil_map_before_20260709_211315.html" -Destination (Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-specialist-contract-insurance-lease.html") -Force

Write-Host "OK: 契約・保険・リース専門画面 AI信頼度/AI判定理由マッピング修正 retry をUNDOしました。"
