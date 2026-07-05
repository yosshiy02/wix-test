$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$After = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"

Copy-Item -LiteralPath $After -Destination $Target -Force

$Check = Get-Content -LiteralPath $Target -Raw -Encoding UTF8

Write-Host "清算済みラベルUIあり:" ($Check -match "isSettledLabelText")
Write-Host "isSettled payloadなし:" (-not ($Check -match "isSettled:\s*!!"))
Write-Host "is_settled payloadなし:" (-not ($Check -match "is_settled:\s*!!"))
Write-Host "collectDraftPayloadあり:" ($Check -match "function collectDraftPayload")
