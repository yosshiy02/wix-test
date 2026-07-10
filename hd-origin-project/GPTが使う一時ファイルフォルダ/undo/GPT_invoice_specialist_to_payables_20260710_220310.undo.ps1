$ErrorActionPreference = "Stop"

$TargetFile = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-invoice-payable.html"
$BeforeFile = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\payment-document-specialist-invoice-payable.before_payable_bridge_20260710_220310.html"

if (-not (Test-Path -LiteralPath $BeforeFile)) {
    throw "beforeファイルが見つかりません: $BeforeFile"
}

$Before = [System.IO.File]::ReadAllText(
    $BeforeFile,
    [System.Text.Encoding]::UTF8
)

$Utf8Bom = New-Object System.Text.UTF8Encoding($true)

[System.IO.File]::WriteAllText(
    $TargetFile,
    $Before,
    $Utf8Bom
)

$Restored = [System.IO.File]::ReadAllText(
    $TargetFile,
    [System.Text.Encoding]::UTF8
)

if (
    $Restored.Contains(
        "HD_ORIGIN_INVOICE_SPECIALIST_PAYABLE_MAPPING_20260710_START"
    )
) {
    throw "UNDO後確認に失敗しました。"
}

Write-Host ""
Write-Host "=========================================="
Write-Host "UNDO成功"
Write-Host "=========================================="
Write-Host "請求・未払系専門解析画面を修正前へ戻しました。"
Write-Host "Git操作: 未実施"
Write-Host "サーバー再起動: 不要"
Write-Host "GPT2側: 未使用"