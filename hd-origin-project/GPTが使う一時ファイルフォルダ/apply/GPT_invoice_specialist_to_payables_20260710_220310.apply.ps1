$ErrorActionPreference = "Stop"

$TargetFile = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-invoice-payable.html"
$AfterFile  = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\payment-document-specialist-invoice-payable.after_payable_bridge_20260710_220310.html"
$BeforeFile = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\payment-document-specialist-invoice-payable.before_payable_bridge_20260710_220310.html"

if (-not (Test-Path -LiteralPath $TargetFile)) {
    throw "反映先が見つかりません: $TargetFile"
}

if (-not (Test-Path -LiteralPath $AfterFile)) {
    throw "afterファイルが見つかりません: $AfterFile"
}

if (-not (Test-Path -LiteralPath $BeforeFile)) {
    throw "beforeファイルが見つかりません: $BeforeFile"
}

$Current = [System.IO.File]::ReadAllText(
    $TargetFile,
    [System.Text.Encoding]::UTF8
)

if (
    $Current.Contains(
        "HD_ORIGIN_INVOICE_SPECIALIST_PAYABLE_MAPPING_20260710_START"
    )
) {
    throw "この修正はすでに反映されています。"
}

$Before = [System.IO.File]::ReadAllText(
    $BeforeFile,
    [System.Text.Encoding]::UTF8
)

if ($Current -ne $Before) {
    throw "本体が準備時から変更されています。上書きを中止しました。"
}

$After = [System.IO.File]::ReadAllText(
    $AfterFile,
    [System.Text.Encoding]::UTF8
)

$Utf8Bom = New-Object System.Text.UTF8Encoding($true)

[System.IO.File]::WriteAllText(
    $TargetFile,
    $After,
    $Utf8Bom
)

$Applied = [System.IO.File]::ReadAllText(
    $TargetFile,
    [System.Text.Encoding]::UTF8
)

if (
    -not $Applied.Contains(
        "registerSelectedSpecialistToPayables"
    )
) {
    [System.IO.File]::WriteAllText(
        $TargetFile,
        $Before,
        $Utf8Bom
    )

    throw "反映後確認に失敗したため、元へ戻しました。"
}

Write-Host ""
Write-Host "=========================================="
Write-Host "反映成功"
Write-Host "=========================================="
Write-Host "追加: 未払管理へ登録"
Write-Host "登録状態: 下書き"
Write-Host "新しいAI呼出し: なし"
Write-Host "Git操作: 未実施"
Write-Host "サーバー再起動: 不要"
Write-Host "GPT2側: 未使用"