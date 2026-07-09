cd "G:\GITHUB\wix-test\hd-origin-project"
$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\projectStatus.js"
$Dst = Join-Path $ProjectRoot "web_receiver\src\projectStatus.js"

Copy-Item -LiteralPath $Before -Destination $Dst -Force

Write-Host "OK: スタート文書作成JSの専門解析共通設計メモ追記をUNDOしました。"
