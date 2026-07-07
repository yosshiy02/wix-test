$ErrorActionPreference = "Stop"

Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-inbox.html" -Force

$InboxDir = "G:\GITHUB\wix-test\hd-origin-project\storage\payment-documents\scan-inbox"
$BeforeDummyDir = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\storage\payment-documents\scan-inbox"

if (Test-Path -LiteralPath $BeforeDummyDir) {
  Get-ChildItem -LiteralPath $BeforeDummyDir -File -Filter "DUMMY_EVIDENCE_20260707_0825*.meta.json" | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $InboxDir $_.Name) -Force
  }
}

Write-Host "OK: 支払書類INBOX 未分類修正をUNDOしました。"