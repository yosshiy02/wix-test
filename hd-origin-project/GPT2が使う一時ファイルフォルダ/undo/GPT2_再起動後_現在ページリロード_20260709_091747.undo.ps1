$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_再起動後_現在ページリロード_20260709_091747.before.server.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\server.js" -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_再起動後_現在ページリロード_20260709_091747.before.hd-origin-exit-guard.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\hd-origin-exit-guard.js" -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_再起動後_現在ページリロード_20260709_091747.before.start_hd_origin.bat" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\start_hd_origin.bat" -Force
Write-Host "UNDO完了: server.js / hd-origin-exit-guard.js / start_hd_origin.bat を修正前に戻しました。"
