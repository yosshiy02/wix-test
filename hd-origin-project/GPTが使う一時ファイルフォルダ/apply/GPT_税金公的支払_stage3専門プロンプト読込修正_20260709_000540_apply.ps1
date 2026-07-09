cd "G:\GITHUB\wix-test\hd-origin-project"
$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\paymentDocuments\paymentDocuments.aiPromptLoader.js"
$Dst = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\paymentDocuments.aiPromptLoader.js"

Copy-Item -LiteralPath $After -Destination $Dst -Force

$NodePath = "G:\Apps\NodeJS\node.exe"
$Check = & $NodePath --check $Dst 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "本体反映後 aiPromptLoader.js の構文確認に失敗しました。
$Check"
}

Write-Host "OK: stage3専門プロンプト読込の正規化を修正しました。GPT2側は未使用。"
