$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Dest = Join-Path $ProjectRoot "PROJECT_GENERAL_AFFAIRS_AI_PROMPT.txt"
$Backup = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\PROJECT_GENERAL_AFFAIRS_AI_PROMPT.txt.before_20260709_193316.txt"

if (Test-Path $Backup) {
  Copy-Item -LiteralPath $Backup -Destination $Dest -Force
  Write-Host "OK: 総務AIプロンプトを before から復元しました。"
  Write-Host "復元先: $Dest"
} else {
  if (Test-Path $Dest) {
    Remove-Item -LiteralPath $Dest -Force
    Write-Host "OK: 今回新規作成した総務AIプロンプトを削除しました。"
    Write-Host "削除: $Dest"
  } else {
    Write-Host "UNDO対象はありません。"
  }
}
