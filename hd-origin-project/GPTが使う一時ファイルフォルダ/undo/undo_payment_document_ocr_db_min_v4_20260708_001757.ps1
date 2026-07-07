$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes_before_ocr_db_min_v4_20260708_001757.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js" -Force
Write-Host "UNDO完了: paymentDocuments.routes.js を修正前に戻しました。"
