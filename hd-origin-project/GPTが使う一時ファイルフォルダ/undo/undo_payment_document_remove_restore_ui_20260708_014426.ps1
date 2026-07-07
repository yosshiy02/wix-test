$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review_before_remove_restore_ui_20260708_014426.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html" -Force
Write-Host "HTML UNDO完了: 後追い復元UI削除前に戻しました。"
Write-Host "注意: DB補正のUNDOは必要なら個別に戻してください。"
