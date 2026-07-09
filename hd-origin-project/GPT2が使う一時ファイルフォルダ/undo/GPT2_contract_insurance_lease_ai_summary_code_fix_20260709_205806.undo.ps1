$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_contract_insurance_lease_ai_summary_code_fix_20260709_205806.before_web_receiver_src_paymentDocuments_prompts_stage3-specialist_contract-insurance-lease_rules.txt" -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\rules.txt") -Force
Write-Host "OK: 契約保険リース専門プロンプト ai_summary/code補強をUNDOしました。"
