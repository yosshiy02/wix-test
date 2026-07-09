$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$AfterDir = Join-Path $TempRoot "after"
Copy-Item -LiteralPath (Join-Path $AfterDir "web_receiver\public\payables\payment-document-specialist-contract-insurance-lease.html") -Destination (Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-specialist-contract-insurance-lease.html") -Force
Copy-Item -LiteralPath (Join-Path $AfterDir "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\system.txt") -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\system.txt") -Force
Copy-Item -LiteralPath (Join-Path $AfterDir "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\fields.txt") -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\fields.txt") -Force
Copy-Item -LiteralPath (Join-Path $AfterDir "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\rules.txt") -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\rules.txt") -Force
Copy-Item -LiteralPath (Join-Path $AfterDir "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\examples.txt") -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\examples.txt") -Force
Write-Host "OK: 契約・保険・リース専門システム retry 反映完了"
