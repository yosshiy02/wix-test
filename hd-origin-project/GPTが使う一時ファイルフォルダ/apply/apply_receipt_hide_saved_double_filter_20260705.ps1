$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$After = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.routes.js"
$Target = Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.routes.js"

Copy-Item -LiteralPath $After -Destination $Target -Force

$NodePath = "G:\Apps\NodeJS\node.exe"
if (!(Test-Path $NodePath)) { $NodePath = "node" }

$Check = & $NodePath --check $Target 2>&1
$Ok = $LASTEXITCODE -eq 0

Write-Host "routes node --check OK:" $Ok
if (!$Ok) { Write-Host $Check }

$Text = Get-Content -LiteralPath $Target -Raw -Encoding UTF8
Write-Host "二重フィルターあり:" ($Text -match "RECEIPT_HIDE_SAVED_IMPORTS_ROUTE_DOUBLE_FILTER_20260705_START")
Write-Host "visibleItems返却あり:" ($Text -match "items: visibleItems")
Write-Host "本保存済み除外あり:" ($Text -match "本保存済み")

if (!$Ok) {
  throw "routes構文チェックNGです。UNDOしてください。"
}
