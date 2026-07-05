$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_screen_ocr_time_fallback.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html" -Force
Write-Host "UNDO完了: 画面側OCR時刻抽出修正前へ戻しました。"
