$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\pd_routes_broken_20260709_213414.js" -Destination (Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\paymentDocuments.routes.js") -Force
Write-Host "OK: 壊れていた復旧前 routes.js に戻しました。"
