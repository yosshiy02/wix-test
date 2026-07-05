$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.ai_before_receipt_time_ocr_extract_final.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.ai.js" -Force
Write-Host "UNDO完了: レシート時刻OCR直接抽出前へ戻しました。"
