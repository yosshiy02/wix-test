$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-saved-list.html"
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-saved-list.html"

Copy-Item -LiteralPath $After -Destination $Target -Force

Write-Host "OK: レシート台帳ページにサーバー再起動ボタンを追加しました。"
