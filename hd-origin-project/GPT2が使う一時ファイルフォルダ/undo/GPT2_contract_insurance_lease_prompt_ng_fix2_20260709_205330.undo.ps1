$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_contract_insurance_lease_prompt_ng_fix2_20260709_205330.before_web_receiver_src_paymentDocuments_prompts_stage3-specialist_contract-insurance-lease_system.txt" -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\system.txt") -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_contract_insurance_lease_prompt_ng_fix2_20260709_205330.before_web_receiver_src_paymentDocuments_prompts_stage3-specialist_contract-insurance-lease_rules.txt" -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\rules.txt") -Force
Write-Host "OK: 契約・保険・リース専門プロンプトNG再補強をUNDOしました。"
