$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_restore_pool_crash_fix_20260709_112302.before.server.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\server.js" -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_restore_pool_crash_fix_20260709_112302.before.backup.service.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\backups\backup.service.js" -Force
Write-Host "UNDO完了: server.js / backup.service.js を修正前に戻しました。"
