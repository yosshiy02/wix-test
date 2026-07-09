$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$PromptDir = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\common"
$BeforeDir = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before"

New-Item -ItemType Directory -Force -Path $PromptDir, $BeforeDir | Out-Null

$Files = @(
  @{ Name = "general-affairs-ai.txt"; Source = "GPTが使う一時ファイルフォルダ\after\general-affairs-ai.txt.after_20260709_193826.txt"; Backup = "general-affairs-ai.txt.before_20260709_193826.txt" },
  @{ Name = "general-affairs-ai-notes.md"; Source = "GPTが使う一時ファイルフォルダ\after\general-affairs-ai-notes.md.after_20260709_193826.md"; Backup = "general-affairs-ai-notes.md.before_20260709_193826.md" },
  @{ Name = "general-affairs-ai-changelog.md"; Source = "GPTが使う一時ファイルフォルダ\after\general-affairs-ai-changelog.md.after_20260709_193826.md"; Backup = "general-affairs-ai-changelog.md.before_20260709_193826.md" }
)

foreach ($F in $Files) {
  $Dest = Join-Path $PromptDir $F.Name
  $Source = Join-Path $ProjectRoot $F.Source
  $Backup = Join-Path $BeforeDir $F.Backup

  if (Test-Path $Dest) {
    Copy-Item -LiteralPath $Dest -Destination $Backup -Force
  }

  Copy-Item -LiteralPath $Source -Destination $Dest -Force
  Write-Host "OK: $($F.Name) を反映しました。"
}

Write-Host ""
Write-Host "OK: 総務AI 成長型3ファイルを導入しました。"
Write-Host "反映先: $PromptDir"
