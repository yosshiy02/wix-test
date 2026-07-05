$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_receipt_time_null_rule.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html" -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.ai_before_receipt_time_null_rule.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.ai.js" -Force
Write-Host "UNDO完了: レシート時刻NULL運用の修正前へ戻しました。"
