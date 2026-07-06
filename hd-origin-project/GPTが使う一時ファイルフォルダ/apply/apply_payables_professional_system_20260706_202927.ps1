$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
Copy-Item -LiteralPath (Join-Path $TempRoot "after\web_receiver\server_after_payables_system_20260706_202927.js") -Destination (Join-Path $ProjectRoot "web_receiver\server.js") -Force
Copy-Item -LiteralPath (Join-Path $TempRoot "after\web_receiver\public\index_after_payables_system_20260706_202927.html") -Destination (Join-Path $ProjectRoot "web_receiver\public\index.html") -Force
Copy-Item -LiteralPath (Join-Path $TempRoot "after\web_receiver\src\payables\payables.repository_after_20260706_202927.js") -Destination (Join-Path $ProjectRoot "web_receiver\src\payables\payables.repository.js") -Force
Copy-Item -LiteralPath (Join-Path $TempRoot "after\web_receiver\src\payables\payables.routes_after_20260706_202927.js") -Destination (Join-Path $ProjectRoot "web_receiver\src\payables\payables.routes.js") -Force
Copy-Item -LiteralPath (Join-Path $TempRoot "after\web_receiver\public\payables\payable-list_after_20260706_202927.html") -Destination (Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html") -Force
Copy-Item -LiteralPath (Join-Path $TempRoot "after\database\migrations\20260706_001_payables_professional_after_20260706_202927.sql") -Destination (Join-Path $ProjectRoot "database\migrations\20260706_001_payables_professional.sql") -Force
Copy-Item -LiteralPath (Join-Path $TempRoot "after\database\design\payables_professional_design_20260706_after_20260706_202927.sql") -Destination (Join-Path $ProjectRoot "database\design\payables_professional_design_20260706.sql") -Force
Write-Host "OK: 請求書・未払管理システムのファイルを再反映しました。DBマイグレーションは本作成時に適用済みです。"
