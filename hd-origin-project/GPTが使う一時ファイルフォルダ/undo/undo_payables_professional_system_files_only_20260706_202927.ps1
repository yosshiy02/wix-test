$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
Copy-Item -LiteralPath (Join-Path $TempRoot "before\web_receiver\server_before_payables_system_20260706_202927.js") -Destination (Join-Path $ProjectRoot "web_receiver\server.js") -Force
Copy-Item -LiteralPath (Join-Path $TempRoot "before\web_receiver\public\index_before_payables_system_20260706_202927.html") -Destination (Join-Path $ProjectRoot "web_receiver\public\index.html") -Force
$HadRepoBefore = $False
$HadRoutesBefore = $False
$HadPageBefore = $True
$HadMigrationBefore = $False
if ($HadRepoBefore) {
  Copy-Item -LiteralPath (Join-Path $TempRoot "before\web_receiver\src\payables\payables.repository_before_20260706_202927.js") -Destination (Join-Path $ProjectRoot "web_receiver\src\payables\payables.repository.js") -Force
} else {
  Remove-Item -LiteralPath (Join-Path $ProjectRoot "web_receiver\src\payables\payables.repository.js") -Force -ErrorAction SilentlyContinue
}
if ($HadRoutesBefore) {
  Copy-Item -LiteralPath (Join-Path $TempRoot "before\web_receiver\src\payables\payables.routes_before_20260706_202927.js") -Destination (Join-Path $ProjectRoot "web_receiver\src\payables\payables.routes.js") -Force
} else {
  Remove-Item -LiteralPath (Join-Path $ProjectRoot "web_receiver\src\payables\payables.routes.js") -Force -ErrorAction SilentlyContinue
}
if ($HadPageBefore) {
  Copy-Item -LiteralPath (Join-Path $TempRoot "before\web_receiver\public\payables\payable-list_before_20260706_202927.html") -Destination (Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html") -Force
} else {
  Remove-Item -LiteralPath (Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html") -Force -ErrorAction SilentlyContinue
}
if ($HadMigrationBefore) {
  Copy-Item -LiteralPath (Join-Path $TempRoot "before\database\migrations\20260706_001_payables_professional_before_20260706_202927.sql") -Destination (Join-Path $ProjectRoot "database\migrations\20260706_001_payables_professional.sql") -Force
} else {
  Remove-Item -LiteralPath (Join-Path $ProjectRoot "database\migrations\20260706_001_payables_professional.sql") -Force -ErrorAction SilentlyContinue
}
Write-Host "OK: 請求書・未払管理システムのファイルをUNDOしました。"
Write-Host "注意: DBテーブルはデータ保護のため、このUNDOでは削除しません。不要なら別途DROP確認が必要です。"
