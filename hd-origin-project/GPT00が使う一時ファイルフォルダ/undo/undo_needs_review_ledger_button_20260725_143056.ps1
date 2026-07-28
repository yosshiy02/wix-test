$ErrorActionPreference = "Stop"

[Console]::InputEncoding =
    New-Object System.Text.UTF8Encoding($false)

[Console]::OutputEncoding =
    New-Object System.Text.UTF8Encoding($false)

$OutputEncoding =
    New-Object System.Text.UTF8Encoding($false)

chcp 65001 | Out-Null

$Source = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT00が使う一時ファイルフォルダ\before\needs-review-specialist.before_ledger_button_20260725_143056.html"
$Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-needs-review.html"

if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
    throw "UNDO元ファイルが存在しません。PATH=$Source"
}

Copy-Item 
    -LiteralPath $Source 
    -Destination $Target 
    -Force

$Output = @(
    "RESTORED=" + $Target
    "OVERALL_STATUS=SUCCESS"
)

Write-Host ($Output -join [Environment]::NewLine)

try {
    Set-Clipboard 
        -Value ($Output -join [Environment]::NewLine) 
        -ErrorAction Stop

    Write-Host "CLIPBOARD_STATUS=SUCCESS"
}
catch {
    Write-Host "CLIPBOARD_STATUS=FAILED"
    Write-Host ("CLIPBOARD_ERROR=" + $_.Exception.Message)
}