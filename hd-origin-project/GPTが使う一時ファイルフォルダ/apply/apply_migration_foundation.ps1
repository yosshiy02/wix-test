$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\database\migrations" | Out-Null
New-Item -ItemType Directory -Force -Path "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\migrations" | Out-Null

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\database\migrations\README_MIGRATIONS.txt" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\database\migrations\README_MIGRATIONS.txt" -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\database\migrations\20260703_001_baseline_current_schema.sql" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\database\migrations\20260703_001_baseline_current_schema.sql" -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\migrations\migration.service.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\migrations\migration.service.js" -Force

$NodeExe = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path -LiteralPath $NodeExe)) {
  $NodeExe = "node"
}

& $NodeExe --check "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\migrations\migration.service.js"
if ($LASTEXITCODE -ne 0) {
  throw "migration.service.js 反映後の構文チェックに失敗しました。"
}

Write-Host "DBマイグレーション土台ファイルを反映しました。"
