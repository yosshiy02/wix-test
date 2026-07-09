# GPT00_server_restart_marker_stale_fix_20260709_214209 undo
$ErrorActionPreference = "Stop"
Copy-Item -Path "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT00_server_restart_marker_stale_fix_20260709_214209.before.server.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\server.js" -Force
Write-Host "UNDO完了: server.js 再起動マーカー stale 対策を戻しました。"