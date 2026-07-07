# ==============================
# UNDO 支払書類INBOX レシート取込風レイアウト
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

Write-Host "OK: 支払書類INBOX レシート取込風レイアウトをUNDOしました。"