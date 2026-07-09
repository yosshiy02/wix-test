$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_contract_insurance_lease_complete_retry_20260709_204220.before.html" -Destination (Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-specialist-contract-insurance-lease.html") -Force
Remove-Item -LiteralPath (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\system.txt") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\fields.txt") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\rules.txt") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\examples.txt") -Force -ErrorAction SilentlyContinue
Write-Host "OK: 契約・保険・リース専門システム retry 修正をUNDOしました。"
