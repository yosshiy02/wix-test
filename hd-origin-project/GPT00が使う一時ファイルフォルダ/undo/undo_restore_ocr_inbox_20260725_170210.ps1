$ErrorActionPreference = "Stop"

[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)
chcp 65001 | Out-Null

$Results = New-Object System.Collections.Generic.List[string]

if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260718_182408_307_2026-07-18_11.11.02.png.meta.json' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260718_182408_307_2026-07-18_11.11.02.png.meta.json' -Force
    $Results.Add('META_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260718_182408_307_2026-07-18_11.11.02.png.meta.json')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_000600_356_2026-07-05_10.37.03.png.meta.json' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_000600_356_2026-07-05_10.37.03.png.meta.json' -Force
    $Results.Add('META_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_000600_356_2026-07-05_10.37.03.png.meta.json')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260716_220826_467_2026-07-01_21.59.06.png.meta.json' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260716_220826_467_2026-07-01_21.59.06.png.meta.json' -Force
    $Results.Add('META_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260716_220826_467_2026-07-01_21.59.06.png.meta.json')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260718_190922_629_2026-07-09_13.35.32.png.meta.json' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260718_190922_629_2026-07-09_13.35.32.png.meta.json' -Force
    $Results.Add('META_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260718_190922_629_2026-07-09_13.35.32.png.meta.json')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_220925_664_2026-07-06_16.26.05.pdf.meta.json' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_220925_664_2026-07-06_16.26.05.pdf.meta.json' -Force
    $Results.Add('META_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_220925_664_2026-07-06_16.26.05.pdf.meta.json')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221308_339_2026-07-06_07.24.29.pdf.meta.json' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221308_339_2026-07-06_07.24.29.pdf.meta.json' -Force
    $Results.Add('META_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221308_339_2026-07-06_07.24.29.pdf.meta.json')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221627_604_2026-07-05_10.37.03.png.meta.json' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221627_604_2026-07-05_10.37.03.png.meta.json' -Force
    $Results.Add('META_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221627_604_2026-07-05_10.37.03.png.meta.json')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_215954_980_2026-07-03_13.56.30.png.meta.json' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_215954_980_2026-07-03_13.56.30.png.meta.json' -Force
    $Results.Add('META_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_215954_980_2026-07-03_13.56.30.png.meta.json')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_220519_003_2026-07-03_13.56.30.png.meta.json' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_220519_003_2026-07-03_13.56.30.png.meta.json' -Force
    $Results.Add('META_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_220519_003_2026-07-03_13.56.30.png.meta.json')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221801_242_2026-07-03_13.56.30.png.meta.json' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221801_242_2026-07-03_13.56.30.png.meta.json' -Force
    $Results.Add('META_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221801_242_2026-07-03_13.56.30.png.meta.json')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221932_652_2026-07-02_14.26.31.png.meta.json' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221932_652_2026-07-02_14.26.31.png.meta.json' -Force
    $Results.Add('META_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221932_652_2026-07-02_14.26.31.png.meta.json')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_222146_000_2026-07-02_14.26.31.png.meta.json' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_222146_000_2026-07-02_14.26.31.png.meta.json' -Force
    $Results.Add('META_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_222146_000_2026-07-02_14.26.31.png.meta.json')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_223309_635_2026-07-01_22.03.41.png.meta.json' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_223309_635_2026-07-01_22.03.41.png.meta.json' -Force
    $Results.Add('META_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_223309_635_2026-07-01_22.03.41.png.meta.json')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260718_182408_307_2026-07-18_11.11.02.png' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260718_182408_307_2026-07-18_11.11.02.png' -Force
    $Results.Add('FILE_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260718_182408_307_2026-07-18_11.11.02.png')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_000600_356_2026-07-05_10.37.03.png' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_000600_356_2026-07-05_10.37.03.png' -Force
    $Results.Add('FILE_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_000600_356_2026-07-05_10.37.03.png')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260716_220826_467_2026-07-01_21.59.06.png' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260716_220826_467_2026-07-01_21.59.06.png' -Force
    $Results.Add('FILE_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260716_220826_467_2026-07-01_21.59.06.png')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260718_190922_629_2026-07-09_13.35.32.png' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260718_190922_629_2026-07-09_13.35.32.png' -Force
    $Results.Add('FILE_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260718_190922_629_2026-07-09_13.35.32.png')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_220925_664_2026-07-06_16.26.05.pdf' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_220925_664_2026-07-06_16.26.05.pdf' -Force
    $Results.Add('FILE_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_220925_664_2026-07-06_16.26.05.pdf')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221308_339_2026-07-06_07.24.29.pdf' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221308_339_2026-07-06_07.24.29.pdf' -Force
    $Results.Add('FILE_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221308_339_2026-07-06_07.24.29.pdf')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221627_604_2026-07-05_10.37.03.png' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221627_604_2026-07-05_10.37.03.png' -Force
    $Results.Add('FILE_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221627_604_2026-07-05_10.37.03.png')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_215954_980_2026-07-03_13.56.30.png' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_215954_980_2026-07-03_13.56.30.png' -Force
    $Results.Add('FILE_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_215954_980_2026-07-03_13.56.30.png')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_220519_003_2026-07-03_13.56.30.png' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_220519_003_2026-07-03_13.56.30.png' -Force
    $Results.Add('FILE_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_220519_003_2026-07-03_13.56.30.png')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221801_242_2026-07-03_13.56.30.png' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221801_242_2026-07-03_13.56.30.png' -Force
    $Results.Add('FILE_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221801_242_2026-07-03_13.56.30.png')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221932_652_2026-07-02_14.26.31.png' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221932_652_2026-07-02_14.26.31.png' -Force
    $Results.Add('FILE_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_221932_652_2026-07-02_14.26.31.png')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_222146_000_2026-07-02_14.26.31.png' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_222146_000_2026-07-02_14.26.31.png' -Force
    $Results.Add('FILE_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_222146_000_2026-07-02_14.26.31.png')
}
if (Test-Path -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_223309_635_2026-07-01_22.03.41.png' -PathType Leaf) {
    Remove-Item -LiteralPath 'F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_223309_635_2026-07-01_22.03.41.png' -Force
    $Results.Add('FILE_DELETED=F:\Dropbox\HDDBTEST\HDDB_PROJECT\ORIGIN\payment-documents\scan-inbox\20260717_223309_635_2026-07-01_22.03.41.png')
}

$Results.Add("OVERALL_STATUS=SUCCESS")

try {
    Set-Clipboard -Value ($Results -join [Environment]::NewLine) -ErrorAction Stop
    $Results.Add("CLIPBOARD_STATUS=SUCCESS")
}
catch {
    $Results.Add("CLIPBOARD_STATUS=FAILED")
    $Results.Add("CLIPBOARD_ERROR=" + $_.Exception.Message)
}

Write-Host ($Results -join [Environment]::NewLine)
Write-Host ""
Write-Host "このPowerShell画面は閉じません。"