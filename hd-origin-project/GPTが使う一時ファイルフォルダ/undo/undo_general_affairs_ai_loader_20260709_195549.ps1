$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project"

$LoaderPath = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\paymentDocuments.aiPromptLoader.js"
$PromptDir  = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\common"

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\paymentDocuments.aiPromptLoader.before_general_affairs_20260709_195549.js" -Destination $LoaderPath -Force

$Targets = @(
  (Join-Path $PromptDir "general-affairs-ai.txt"),
  (Join-Path $PromptDir "general-affairs-ai-notes.md"),
  (Join-Path $PromptDir "general-affairs-ai-changelog.md")
)

foreach ($T in $Targets) {
  if (Test-Path -LiteralPath $T) {
    Remove-Item -LiteralPath $T -Force
    Write-Host "削除: $T"
  }
}

$Check = & node --check $LoaderPath 2>&1
if ($LASTEXITCODE -ne 0) {
  $Check | Out-String | Write-Host
  throw "UNDO後の node --check に失敗しました。"
}

Write-Host "OK: 総務AIローダー組み込みをUNDOしました。"
Write-Host "loader restored: $LoaderPath"
