$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$AfterDir = Join-Path $TempRoot "after"
Copy-Item -LiteralPath (Join-Path $AfterDir "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\fields.txt") -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\fields.txt") -Force
Copy-Item -LiteralPath (Join-Path $AfterDir "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\examples.txt") -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\stage3-specialist\contract-insurance-lease\examples.txt") -Force
Write-Host "OK: 契約・保険・リース専門プロンプトNG補強を反映しました。"
