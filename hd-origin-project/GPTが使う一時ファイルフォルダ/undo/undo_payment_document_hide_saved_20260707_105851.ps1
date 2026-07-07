$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath 'G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes_before_hide_saved_20260707_105851.js' -Destination 'G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js' -Force
Write-Host "OK: undo payment document hide saved inbox items."
