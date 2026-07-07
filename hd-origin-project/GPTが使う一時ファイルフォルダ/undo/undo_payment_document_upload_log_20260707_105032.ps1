$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath 'G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox_before_upload_log_20260707_105032.html' -Destination 'G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-inbox.html' -Force
Write-Host "OK: undo payment document upload log window."
