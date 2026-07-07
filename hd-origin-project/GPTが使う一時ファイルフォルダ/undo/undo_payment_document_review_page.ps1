$ErrorActionPreference = "Stop"

if (Test-Path -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox.html") {
  Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-inbox.html" -Force
  Write-Host "RESTORED: web_receiver\public\payables\payment-document-inbox.html"
}

if (Test-Path -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review.html") {
  Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html" -Force
  Write-Host "RESTORED: web_receiver\public\payables\payment-document-review.html"
} else {
  if (Test-Path -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html") {
    Remove-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html" -Force
    Write-Host "REMOVED: web_receiver\public\payables\payment-document-review.html"
  }
}

if (Test-Path -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review.css") {
  Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review.css" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.css" -Force
  Write-Host "RESTORED: web_receiver\public\payables\payment-document-review.css"
} else {
  if (Test-Path -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.css") {
    Remove-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.css" -Force
    Write-Host "REMOVED: web_receiver\public\payables\payment-document-review.css"
  }
}

Write-Host "OK: AI解析・下書き編集ページ追加をUNDOしました。"