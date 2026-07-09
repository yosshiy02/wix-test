$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Source = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\PROJECT_GENERAL_AFFAIRS_AI_PROMPT.txt.after_20260709_193316.txt"
$Dest = Join-Path $ProjectRoot "PROJECT_GENERAL_AFFAIRS_AI_PROMPT.txt"
$Backup = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\PROJECT_GENERAL_AFFAIRS_AI_PROMPT.txt.before_20260709_193316.txt"

New-Item -ItemType Directory -Force -Path (Split-Path $Backup -Parent) | Out-Null

if (Test-Path $Dest) {
  Copy-Item -LiteralPath $Dest -Destination $Backup -Force
}

Copy-Item -LiteralPath $Source -Destination $Dest -Force

Write-Host "OK: 総務AIプロンプトを導入しました。"
Write-Host "作成/更新: $Dest"
if (Test-Path $Backup) {
  Write-Host "before: $Backup"
}
