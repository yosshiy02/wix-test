$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$After = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"

Copy-Item -LiteralPath $After -Destination $Target -Force

$Check = Get-Content -LiteralPath $Target -Raw -Encoding UTF8

Write-Host "清算済みラベル関数あり:" ($Check -match "updateReceiptSettledLabel")
Write-Host "清算済みラベルUIあり:" ($Check -match "isSettledLabelText")
Write-Host "未精算文字あり:" ($Check -match "未精算")
Write-Host "清算済み文字あり:" ($Check -match "清算済み")
Write-Host "isSettled payloadあり:" ($Check -match "isSettled:")
Write-Host "is_settled payloadあり:" ($Check -match "is_settled:")
