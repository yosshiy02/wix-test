$ErrorActionPreference = "Stop"

# 注意:
# このUNDOはファイルだけを戻します。
# DB内の system.schema_migrations は削除しません。

if (Test-Path -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\migrations\migration.service.js") {
  Remove-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\migrations\migration.service.js" -Force
}

if (Test-Path -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\database\migrations\README_MIGRATIONS.txt") {
  Remove-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\database\migrations\README_MIGRATIONS.txt" -Force
}

if (Test-Path -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\database\migrations\20260703_001_baseline_current_schema.sql") {
  Remove-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\database\migrations\20260703_001_baseline_current_schema.sql" -Force
}

Write-Host "DBマイグレーション土台ファイルを削除しました。DB内の履歴テーブルは触っていません。"
