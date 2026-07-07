$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes_before_review_items_db_only_20260708_013734.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js" -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review_before_review_items_db_only_20260708_013734.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html" -Force
Write-Host "UNDO完了: DB専用review-items修正前に戻しました。"
