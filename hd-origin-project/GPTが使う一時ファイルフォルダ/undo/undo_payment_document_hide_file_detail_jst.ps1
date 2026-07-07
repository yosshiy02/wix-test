$ErrorActionPreference = "Stop"

Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-inbox.html" -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox.css" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-inbox.css" -Force

Write-Host "OK: ファイル詳細欄非表示・日本時間化修正をUNDOしました。"