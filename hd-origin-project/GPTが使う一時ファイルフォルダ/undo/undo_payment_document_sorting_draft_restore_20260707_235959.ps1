$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes.js.before_sorting_draft_restore_20260707_235959" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js" -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review.html.before_sorting_draft_restore_20260707_235959" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html" -Force
Write-Host "UNDO完了: 保存済み下書き復元修正を戻しました。"
