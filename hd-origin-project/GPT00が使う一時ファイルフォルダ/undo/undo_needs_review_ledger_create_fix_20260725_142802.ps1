$ErrorActionPreference = "Stop"

[Console]::InputEncoding =
    New-Object System.Text.UTF8Encoding($false)

[Console]::OutputEncoding =
    New-Object System.Text.UTF8Encoding($false)

$OutputEncoding =
    New-Object System.Text.UTF8Encoding($false)

chcp 65001 | Out-Null

$Targets = @(
    "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\ledgers\reports\needs-review-ledger-report.html",
    "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\ledgers\reports\needs-review-ledger-report.css",
    "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\ledgers\reports\needs-review-ledger-report.js"
)

$Output = New-Object System.Collections.Generic.List[string]

foreach ($Target in $Targets) {
    if (Test-Path -LiteralPath $Target -PathType Leaf) {
        Remove-Item 
            -LiteralPath $Target 
            -Force

        $Output.Add("DELETED=" + $Target)
    }
    else {
        $Output.Add("NOT_FOUND=" + $Target)
    }
}

$Output.Add("OVERALL_STATUS=SUCCESS")

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