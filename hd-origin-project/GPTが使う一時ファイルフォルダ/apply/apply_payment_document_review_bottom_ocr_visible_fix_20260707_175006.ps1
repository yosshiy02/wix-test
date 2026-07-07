$ErrorActionPreference = 'Stop'
Copy-Item -LiteralPath 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\payables\payment-document-review_after_bottom_ocr_visible_fix_20260707_175006.html' -Destination 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html' -Force
Copy-Item -LiteralPath 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\payables\payment-document-review_after_bottom_ocr_visible_fix_20260707_175006.css'  -Destination 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.css'  -Force
Write-Host 'OK: 下部OCR本文情報ウインドウを表示修正しました。'
