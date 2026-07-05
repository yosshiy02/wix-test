$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Before = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.routes_before_hide_saved_double_filter_20260705.js"
$Target = Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.routes.js"

Copy-Item -LiteralPath $Before -Destination $Target -Force
Write-Host "UNDO完了: receipts.routes.js を二重フィルター追加前へ戻しました。"
