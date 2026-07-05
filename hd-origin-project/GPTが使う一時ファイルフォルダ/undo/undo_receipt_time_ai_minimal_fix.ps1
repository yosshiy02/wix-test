$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_time_ai_minimal_fix.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html" -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.ai_before_time_ai_minimal_fix.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.ai.js" -Force
Write-Host "UNDO完了: レシート時刻AI認識の最小修正前へ戻しました。"
