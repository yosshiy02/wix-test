$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Src = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-ledger-print.html"
if (Test-Path -LiteralPath $Src) {
  Remove-Item -LiteralPath $Src -Force
}
Write-Host "OK: receipt-ledger-print.html を削除しました"
