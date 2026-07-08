$ErrorActionPreference = "Stop"
Write-Host "analysis_system_* routes反映をUNDOします。"
Copy-Item -LiteralPath 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT2が使う一時ファイルフォルダ\after\web_receiver\src\paymentDocuments\paymentDocuments.routes.js.before_analysis_system_routes_20260708_170843' -Destination 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\after\web_receiver\src\paymentDocuments\paymentDocuments.routes.js' -Force
Write-Host "OK: UNDO完了"