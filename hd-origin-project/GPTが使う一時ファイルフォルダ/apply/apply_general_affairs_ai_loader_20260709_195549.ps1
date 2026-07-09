$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project"

$LoaderPath = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\paymentDocuments.aiPromptLoader.js"
$PromptDir  = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\common"

New-Item -ItemType Directory -Force -Path $PromptDir | Out-Null

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\paymentDocuments.aiPromptLoader.after_general_affairs_20260709_195549.js" -Destination $LoaderPath -Force

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\general-affairs-ai.txt.after_20260709_195549.txt" -Destination (Join-Path $PromptDir "general-affairs-ai.txt") -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\general-affairs-ai-notes.md.after_20260709_195549.md"      -Destination (Join-Path $PromptDir "general-affairs-ai-notes.md") -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\general-affairs-ai-changelog.md.after_20260709_195549.md"     -Destination (Join-Path $PromptDir "general-affairs-ai-changelog.md") -Force

$Check = & node --check $LoaderPath 2>&1
if ($LASTEXITCODE -ne 0) {
  $Check | Out-String | Write-Host
  throw "反映後の node --check に失敗しました。"
}

Write-Host "OK: 総務AIをプロジェクト側AIローダーに組み込みました。"
Write-Host "loader: $LoaderPath"
Write-Host "prompt: $PromptDir"
