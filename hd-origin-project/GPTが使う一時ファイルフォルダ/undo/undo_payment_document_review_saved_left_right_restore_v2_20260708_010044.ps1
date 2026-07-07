$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review_before_saved_left_right_restore_v2_20260708_010044.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html" -Force
Write-Host "UNDO完了: payment-document-review.html を修正前に戻しました。"
