$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-saved-list.html"
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-saved-list.html"

Copy-Item -LiteralPath $After -Destination $Target -Force

Write-Host "OK: 証憑管理情報から取込日時を削除しました。"
Write-Host "残した項目: 保存ID / 取込ID / 元ファイル名 / 保存ファイル名 / 証憑画像パス / 取込ステータス"
