$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_起動時リストア失敗対応_20260709_111732.before.backup.service.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\backups\backup.service.js" -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_起動時リストア失敗対応_20260709_111732.before.server.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\server.js" -Force
Write-Host "UNDO完了: backup.service.js / server.js を修正前に戻しました。"
