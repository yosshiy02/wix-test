$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_起動後バックアップ確認_MessageBox修正_20260709_084813.before.server.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\server.js" -Force
Write-Host "UNDO完了: server.js を修正前に戻しました。"
