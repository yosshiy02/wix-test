$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath 'G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes_before_save_selected_20260707_105546.js' -Destination 'G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js' -Force
Copy-Item -LiteralPath 'G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox_before_save_selected_20260707_105546.html' -Destination 'G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-inbox.html' -Force
Copy-Item -LiteralPath 'G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox_before_save_selected_20260707_105546.css' -Destination 'G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-inbox.css' -Force
Write-Host "OK: undo payment document save selected."
