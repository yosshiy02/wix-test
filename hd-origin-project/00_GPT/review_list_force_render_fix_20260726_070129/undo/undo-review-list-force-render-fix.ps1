[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding  = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding          = [System.Text.UTF8Encoding]::new($false)
chcp 65001 | Out-Null

$ErrorActionPreference = "Stop"

Copy-Item 
    -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\00_GPT\review_list_force_render_fix_20260726_070129\before\payment-document-review.before.html" 
    -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html" 
    -Force

Write-Host "UNDO_STATUS=SUCCESS"
Write-Host "RESTORED_FILE=G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html"