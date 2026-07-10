$ErrorActionPreference = "Stop"

Copy-Item "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\GPT_payable_control_A_20260710_202518.after.payables.repository.js" "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\payables\payables.repository.js" -Force
Copy-Item "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\GPT_payable_control_A_20260710_202518.after.payables.routes.js" "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\payables\payables.routes.js" -Force
Copy-Item "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\GPT_payable_control_A_20260710_202518.after.20260710_001_payable_control_fields.sql" "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\database\migrations\20260710_001_payable_control_fields.sql" -Force

& "C:\Program Files\nodejs\node.exe" --check "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\payables\payables.repository.js"

if ($LASTEXITCODE -ne 0) {
    throw "repository構文エラー"
}

& "C:\Program Files\nodejs\node.exe" --check "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\payables\payables.routes.js"

if ($LASTEXITCODE -ne 0) {
    throw "routes構文エラー"
}

Write-Host "APPLY完了"