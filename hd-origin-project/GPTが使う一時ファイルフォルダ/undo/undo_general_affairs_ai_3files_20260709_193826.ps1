$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$PromptDir = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\common"
$BeforeDir = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before"

$Files = @(
  @{ Name = "general-affairs-ai.txt"; Backup = "general-affairs-ai.txt.before_20260709_193826.txt" },
  @{ Name = "general-affairs-ai-notes.md"; Backup = "general-affairs-ai-notes.md.before_20260709_193826.md" },
  @{ Name = "general-affairs-ai-changelog.md"; Backup = "general-affairs-ai-changelog.md.before_20260709_193826.md" }
)

foreach ($F in $Files) {
  $Dest = Join-Path $PromptDir $F.Name
  $Backup = Join-Path $BeforeDir $F.Backup

  if (Test-Path $Backup) {
    Copy-Item -LiteralPath $Backup -Destination $Dest -Force
    Write-Host "OK: $($F.Name) を before から復元しました。"
  } else {
    if (Test-Path $Dest) {
      Remove-Item -LiteralPath $Dest -Force
      Write-Host "OK: 今回新規作成の $($F.Name) を削除しました。"
    } else {
      Write-Host "UNDO対象なし: $($F.Name)"
    }
  }
}

Write-Host ""
Write-Host "OK: 総務AI 成長型3ファイルのUNDOが完了しました。"
