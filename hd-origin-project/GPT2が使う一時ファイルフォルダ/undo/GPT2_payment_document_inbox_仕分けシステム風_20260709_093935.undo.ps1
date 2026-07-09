$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_payment_document_inbox_仕分けシステム風_20260709_093935.before.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-inbox.html" -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_payment_document_inbox_仕分けシステム風_20260709_093935.before.css" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-inbox.css" -Force
Write-Host "UNDO完了: payment-document-inbox.html / css を修正前に戻しました。"
