$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.repository.js"
$Before = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.repository_before_remove_wrong_expenses_override.js"

Copy-Item $Before $Target -Force

Write-Host "UNDOしました: $Target"
