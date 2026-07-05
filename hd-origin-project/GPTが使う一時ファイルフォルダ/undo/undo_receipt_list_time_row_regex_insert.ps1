$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_time_row_regex_insert.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html" -Force
Write-Host "UNDO完了: レシート時刻 行ブロック正規表現差し込み前へ戻しました。"
