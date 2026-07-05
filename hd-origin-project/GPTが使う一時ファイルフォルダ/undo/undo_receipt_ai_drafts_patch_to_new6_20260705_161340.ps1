$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.routes.js"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.routes_before_ai_drafts_patch_to_new6_20260705_161340.js"
$NodePath = "G:\Apps\NodeJS\node.exe"

Copy-Item -LiteralPath $Before -Destination $Target -Force

$Check = & $NodePath --check $Target 2>&1
if ($LASTEXITCODE -ne 0) {
  $Check
  throw "UNDO後の構文チェックNG"
}

Write-Host "OK: receipts.routes.js を修正前へ戻しました。"
