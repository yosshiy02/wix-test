$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-saved-list.html"
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-saved-list.html"

Copy-Item -LiteralPath $After -Destination $Target -Force

Write-Host "OK: レシート台帳の明細ブロックを明細内訳表だけに整理しました。"
Write-Host "残した項目: 品名 / 数量 / 単価 / 金額 / 税区分 / 税処理 / メモ"
