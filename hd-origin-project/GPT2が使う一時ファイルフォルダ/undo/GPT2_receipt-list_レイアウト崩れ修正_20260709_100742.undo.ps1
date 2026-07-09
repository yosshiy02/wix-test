$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_receipt-list_レイアウト崩れ修正_20260709_100742.before.css" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.css" -Force
Write-Host "UNDO完了: receipt-list.css を修正前に戻しました。"
