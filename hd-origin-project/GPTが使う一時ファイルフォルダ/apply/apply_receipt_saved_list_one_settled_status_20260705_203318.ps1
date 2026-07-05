$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-saved-list.html"
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-saved-list.html"

Copy-Item -LiteralPath $After -Destination $Target -Force

Write-Host "OK: レシート台帳の詳細表示内の清算状態を1つにしました。"
Write-Host "残した表示: 基本情報の精算状態"
Write-Host "削除した表示: 明細ブロック内の精算状態"
