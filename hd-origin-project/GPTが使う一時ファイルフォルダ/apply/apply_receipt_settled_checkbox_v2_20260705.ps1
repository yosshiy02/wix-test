$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$After = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"

Copy-Item -LiteralPath $After -Destination $Target -Force

$Check = Get-Content -LiteralPath $Target -Raw -Encoding UTF8

Write-Host "清算済みチェック関数あり:" ($Check -match "RECEIPT_SETTLED_CHECKBOX_20260705_START")
Write-Host "清算済みチェックUIあり:" ($Check -match "RECEIPT_SETTLED_CHECKBOX_20260705_UI_START")
Write-Host "isSettled payloadあり:" ($Check -match "isSettled:")
Write-Host "is_settled payloadあり:" ($Check -match "is_settled:")
Write-Host "targetPersonIdあり:" ($Check -match "targetPersonId")
