$ErrorActionPreference = "Stop"

Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\index.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\index.html" -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\settings.html" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\settings.html" -Force

Write-Host "OK: 入金管理固定ボタン追加前に戻しました。"