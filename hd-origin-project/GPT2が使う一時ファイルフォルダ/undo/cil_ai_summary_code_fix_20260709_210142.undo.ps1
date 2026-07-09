$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\cil_rules_before_20260709_210142.txt" -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\rules.txt") -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\cil_examples_before_20260709_210142.txt" -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\examples.txt") -Force

Write-Host "OK: 契約・保険・リース専門プロンプト ai_summary/code補強をUNDOしました。"
