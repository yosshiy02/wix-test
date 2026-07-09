$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_起動失敗復旧_古いリストア呼び出し削除_20260709_084426.before.server.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\server.js" -Force
Write-Host "UNDO完了: server.js を修正前に戻しました。"
