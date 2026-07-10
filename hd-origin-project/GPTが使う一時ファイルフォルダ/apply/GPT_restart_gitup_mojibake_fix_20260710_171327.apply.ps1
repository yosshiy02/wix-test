$ErrorActionPreference = "Stop"

Copy-Item `
    -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\GPT_restart_gitup_mojibake_fix_20260710_171327.after.server.js" `
    -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\server.js" `
    -Force

& "C:\Program Files\nodejs\node.exe" --check "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\server.js"

if ($LASTEXITCODE -ne 0) {
    throw "APPLY syntax check failed."
}

Write-Host "APPLY completed."