$ErrorActionPreference = "Stop"

Copy-Item `
    -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT_gitup_restart_shutdown_20260710_172948.before.server.js" `
    -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\server.js" `
    -Force

& "C:\Program Files\nodejs\node.exe" --check "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\server.js"

if ($LASTEXITCODE -ne 0) {
    throw "UNDO後の構文確認に失敗しました。"
}

Write-Host "UNDO完了"