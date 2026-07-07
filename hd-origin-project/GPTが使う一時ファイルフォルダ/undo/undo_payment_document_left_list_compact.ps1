# ==============================
# UNDO 支払書類INBOX 左リスト コンパクト化
# ==============================

$ErrorActionPreference = "Stop"

Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox.css" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-inbox.css" -Force

Write-Host "OK: 支払書類INBOX 左リスト コンパクト化をUNDOしました。"