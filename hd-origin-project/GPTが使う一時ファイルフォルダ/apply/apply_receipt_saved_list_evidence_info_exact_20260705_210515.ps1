$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-saved-list.html"
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-saved-list.html"

Copy-Item -LiteralPath $After -Destination $Target -Force

Write-Host "OK: レシート台帳に折りたたみの証憑管理情報を追加しました。"
Write-Host "追加場所: 明細表示の下"
Write-Host "通常は閉じた状態で表示されます。"
