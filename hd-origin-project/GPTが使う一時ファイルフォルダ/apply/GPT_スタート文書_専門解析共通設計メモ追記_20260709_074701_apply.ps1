cd "G:\GITHUB\wix-test\hd-origin-project"
$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\projectStatus.js"
$Dst = Join-Path $ProjectRoot "web_receiver\src\projectStatus.js"

Copy-Item -LiteralPath $After -Destination $Dst -Force

$NodePath = "G:\Apps\NodeJS\node.exe"
$Check = & $NodePath --check $Dst 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "本体反映後 projectStatus.js の構文確認に失敗しました。
$Check"
}

Write-Host "OK: スタート文書作成JSへ専門解析共通設計メモを追記しました。GPT2側は未使用。"
