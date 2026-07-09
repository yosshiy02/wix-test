$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$AfterDir = Join-Path $TempRoot "after"
Copy-Item -LiteralPath (Join-Path $AfterDir "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\system.txt") -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\system.txt") -Force
Copy-Item -LiteralPath (Join-Path $AfterDir "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\rules.txt") -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\rules.txt") -Force
Write-Host "OK: 契約・保険・リース専門プロンプトNG再補強を反映しました。"
