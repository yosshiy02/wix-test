$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\src\config.js"
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\config.js"

Copy-Item -LiteralPath $After -Destination $Target -Force

$NodePath = "G:\Apps\NodeJS\node.exe"
$Check = & $NodePath --check $Target 2>&1

if ($LASTEXITCODE -ne 0) {
  $Check | Out-String | Write-Host
  throw "本体 config.js の構文チェックNG"
}

Write-Host "OK: config.js 反映完了"
Write-Host "receiptRoot: HD_ORIGIN_RECEIPT_ROOT 優先。なければ HDDBTEST_ROOT\HDDB_PROJECT\ORIGIN\receipts。"
