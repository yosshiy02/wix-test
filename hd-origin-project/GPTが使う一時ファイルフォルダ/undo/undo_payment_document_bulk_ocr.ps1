# ==============================
# UNDO 支払書類INBOX チェックボックス・まとめてOCR追加
# ==============================

$ErrorActionPreference = "Stop"

if (Test-Path -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox.html") {
  Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-inbox.html" -Force
  Write-Host "RESTORED: web_receiver\public\payables\payment-document-inbox.html"
}

if (Test-Path -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox.css") {
  Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox.css" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-inbox.css" -Force
  Write-Host "RESTORED: web_receiver\public\payables\payment-document-inbox.css"
}

if (Test-Path -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes.js") {
  Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js" -Force
  Write-Host "RESTORED: web_receiver\src\paymentDocuments\paymentDocuments.routes.js"
}

Write-Host "OK: 支払書類INBOX チェックボックス・まとめてOCR追加をUNDOしました。"