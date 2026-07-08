$ErrorActionPreference = "Stop"

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\receipt-list.html.before_receipt_header_only_cleanup_GPT2_20260708_183832" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html" -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\receipt-list.css.before_receipt_header_only_cleanup_GPT2_20260708_183832"  -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.css"  -Force

Write-Host "OK: レシート画面ヘッダー整理を元に戻しました。"
