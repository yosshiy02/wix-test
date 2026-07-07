$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review_before_fix_db_load_error_20260708_013330.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html" -Force
Write-Host "UNDO完了: payment-document-review.html をDB読み込みエラー復旧前に戻しました。"
