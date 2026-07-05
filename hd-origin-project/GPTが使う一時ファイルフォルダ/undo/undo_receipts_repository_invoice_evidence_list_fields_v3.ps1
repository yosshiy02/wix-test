$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Src = Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.repository.js"
$BeforeFile = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.repository_before_invoice_evidence_list_fields_v3.js"
Copy-Item -LiteralPath $BeforeFile -Destination $Src -Force
Write-Host "OK: receipts.repository.js を元に戻しました"
