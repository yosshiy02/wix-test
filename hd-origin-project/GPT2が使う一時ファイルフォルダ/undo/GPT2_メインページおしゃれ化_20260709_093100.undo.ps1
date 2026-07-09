$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_メインページおしゃれ化_20260709_093100.before.index.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\index.html" -Force
Write-Host "UNDO完了: index.html を修正前に戻しました。"
