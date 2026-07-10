$ErrorActionPreference = "Stop"

Copy-Item "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT_payable_control_A_20260710_202518.before.payables.repository.js" "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\payables\payables.repository.js" -Force
Copy-Item "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT_payable_control_A_20260710_202518.before.payables.routes.js" "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\payables\payables.routes.js" -Force

& "C:\Program Files\nodejs\node.exe" --check "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\payables\payables.repository.js"

if ($LASTEXITCODE -ne 0) {
    throw "UNDO後repository構文エラー"
}

& "C:\Program Files\nodejs\node.exe" --check "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\payables\payables.routes.js"

if ($LASTEXITCODE -ne 0) {
    throw "UNDO後routes構文エラー"
}

Write-Host "プログラムUNDO完了"
Write-Host "DB追加列は安全のため自動削除していません。"