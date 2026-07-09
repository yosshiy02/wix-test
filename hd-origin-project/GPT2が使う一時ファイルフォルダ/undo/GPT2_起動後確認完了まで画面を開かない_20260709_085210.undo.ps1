$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_起動後確認完了まで画面を開かない_20260709_085210.before.server.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\server.js" -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_起動後確認完了まで画面を開かない_20260709_085210.before.start_hd_origin.bat" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\start_hd_origin.bat" -Force
Write-Host "UNDO完了: server.js / start_hd_origin.bat を修正前に戻しました。"
