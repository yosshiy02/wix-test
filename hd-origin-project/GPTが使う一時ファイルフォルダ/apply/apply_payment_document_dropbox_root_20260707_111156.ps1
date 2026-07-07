$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath 'G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\config_after_payment_document_root_20260707_111156.js' -Destination 'G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\config.js' -Force
Copy-Item -LiteralPath 'G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\paymentDocuments\paymentDocuments.routes_after_payment_document_root_20260707_111156.js' -Destination 'G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js' -Force
Write-Host "OK: applied payment document dropbox root."
