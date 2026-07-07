$ErrorActionPreference = "Stop"
$InboxDir = "G:\GITHUB\wix-test\hd-origin-project\storage\payment-documents\scan-inbox"
$Prefix = "DUMMY_20260707_0815"
Get-ChildItem -LiteralPath $InboxDir -File | Where-Object { $_.Name -like ($Prefix + "*") } | Remove-Item -Force
Write-Host "OK: 支払書類取込のダミー10件を削除しました。"