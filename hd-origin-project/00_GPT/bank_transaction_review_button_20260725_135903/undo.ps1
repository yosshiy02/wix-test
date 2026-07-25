$ErrorActionPreference = "Stop"
chcp 65001 | Out-Null

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding  = $Utf8NoBom
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom

$BeforeFile = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\00_GPT\bank_transaction_review_button_20260725_135903\before.html"
$TargetFile = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-review.html"

if (-not (Test-Path -LiteralPath $BeforeFile)) {
    throw "BEFORE_FILE_NOT_FOUND=$BeforeFile"
}

$Before = [System.IO.File]::ReadAllText(
    $BeforeFile,
    $Utf8NoBom
)

[System.IO.File]::WriteAllText(
    $TargetFile,
    $Before,
    $Utf8NoBom
)

Write-Host "UNDO_STATUS=SUCCESS"
Write-Host "RESTORED_FILE=$TargetFile"