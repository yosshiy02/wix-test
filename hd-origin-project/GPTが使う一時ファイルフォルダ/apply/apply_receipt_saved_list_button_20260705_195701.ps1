$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.html"

Copy-Item -LiteralPath $After -Destination $Target -Force

Write-Host "OK: 読み取り確認ページに本保存済み一覧ボタンを追加しました。"
