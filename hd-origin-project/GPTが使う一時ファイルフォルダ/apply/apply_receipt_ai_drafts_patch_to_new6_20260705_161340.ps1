$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.routes.js"
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.routes.js"
$NodePath = "G:\Apps\NodeJS\node.exe"

Copy-Item -LiteralPath $After -Destination $Target -Force

$Check = & $NodePath --check $Target 2>&1
if ($LASTEXITCODE -ne 0) {
  $Check
  throw "反映後の構文チェックNG"
}

Write-Host "OK: receipts.routes.js を新6下書き更新ルートへ向け替えました。"
