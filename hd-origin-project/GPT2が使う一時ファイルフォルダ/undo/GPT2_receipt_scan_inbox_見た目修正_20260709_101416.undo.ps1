$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_receipt_scan_inbox_見た目修正_20260709_101416.before.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-scan-inbox.html" -Force
Write-Host "UNDO完了: receipt-scan-inbox.html を修正前に戻しました。"
