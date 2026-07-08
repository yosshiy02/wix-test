$ErrorActionPreference = "Stop"
Write-Host "analysis_system_* routes反映を開始します。DBは実行しません。"
Copy-Item -LiteralPath 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\GPT2が使う一時ファイルフォルダ\after\web_receiver\src\paymentDocuments\paymentDocuments.routes.js' -Destination 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\after\web_receiver\src\paymentDocuments\paymentDocuments.routes.js' -Force
Write-Host "OK: paymentDocuments.routes.js へ反映しました。"