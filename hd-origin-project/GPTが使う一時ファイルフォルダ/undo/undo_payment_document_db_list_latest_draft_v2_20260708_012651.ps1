$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes_before_db_list_latest_draft_v2_20260708_012651.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js" -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review_before_db_list_latest_draft_v2_20260708_012651.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html" -Force
Write-Host "UNDO完了: 支払書類DB一覧最新下書き修正v2を戻しました。"
