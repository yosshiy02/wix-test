[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
chcp 65001 | Out-Null
$ErrorActionPreference = "Stop"

Copy-Item 
  -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\00_GPT\ocr_review_master_driven_fix_20260726_062916\before\paymentDocuments.routes.js" 
  -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js" 
  -Force

Write-Host "CODE_UNDO=SUCCESS"
Write-Host "DB復元SQL=G:\GITHUB\wix-test\hd-origin-project\00_GPT\ocr_review_master_driven_fix_20260726_062916\undo\undo-existing-current-status.sql"