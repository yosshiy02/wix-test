$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.html"

Copy-Item -LiteralPath $After -Destination $Target -Force

Write-Host "OK: receipt-list.html に明細件数 window参照修正を反映しました。"
