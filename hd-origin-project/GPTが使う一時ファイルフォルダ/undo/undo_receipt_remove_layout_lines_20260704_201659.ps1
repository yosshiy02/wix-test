$Source = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_remove_layout_lines_20260704_201659.html"
$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"

Copy-Item -LiteralPath $Source -Destination $Target -Force
Write-Host "戻しました: $Target"
