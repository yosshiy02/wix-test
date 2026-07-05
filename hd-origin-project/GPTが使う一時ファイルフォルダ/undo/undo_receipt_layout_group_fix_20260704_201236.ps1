$Source = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_layout_group_fix_20260704_201236.html"
$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"

Copy-Item -LiteralPath $Source -Destination $Target -Force
Write-Host "戻しました: $Target"
