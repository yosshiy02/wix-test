$ErrorActionPreference = "Stop"
$InboxDir = "G:\GITHUB\wix-test\hd-origin-project\storage\payment-documents\scan-inbox"
$Prefix = "DUMMY_EVIDENCE_20260707_0825"
Get-ChildItem -LiteralPath $InboxDir -File | Where-Object { $_.Name -like ($Prefix + "*") } | Remove-Item -Force
Write-Host "OK: 支払書類取込のダミー証憑画像10件を削除しました。"