$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Src = Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.repository.js"
$AfterFile = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.repository.js"
Copy-Item -LiteralPath $AfterFile -Destination $Src -Force
Write-Host "OK: receipts.repository.js へ invoice_type_name / evidence_type_name を反映しました"
