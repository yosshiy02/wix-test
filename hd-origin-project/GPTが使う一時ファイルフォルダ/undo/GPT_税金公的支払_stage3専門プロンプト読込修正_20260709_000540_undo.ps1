cd "G:\GITHUB\wix-test\hd-origin-project"
$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.aiPromptLoader.js"
$Dst = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\paymentDocuments.aiPromptLoader.js"

Copy-Item -LiteralPath $Before -Destination $Dst -Force

Write-Host "OK: stage3専門プロンプト読込修正をUNDOしました。"
