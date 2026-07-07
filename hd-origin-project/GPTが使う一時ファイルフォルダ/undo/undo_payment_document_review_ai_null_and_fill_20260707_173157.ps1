$ErrorActionPreference = 'Stop'
Copy-Item -LiteralPath 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review_before_ai_null_and_fill_20260707_173157.html' -Destination 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html' -Force
Copy-Item -LiteralPath 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review_before_ai_null_and_fill_20260707_173157.css'  -Destination 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.css'  -Force
Write-Host 'OK: AI空欄NULL化・入力済み欄の塗りつぶし修正を戻しました。'
