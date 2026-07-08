$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$PromptRoot = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\prompts"
$BeforePromptRoot = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\prompts_payment_documents_3stage_before_20260708_214359"

if (Test-Path -LiteralPath $PromptRoot) {
    Remove-Item -LiteralPath $PromptRoot -Recurse -Force
}

$OriginalCopy = Get-ChildItem -LiteralPath $BeforePromptRoot -Directory | Select-Object -First 1

if ($OriginalCopy) {
    New-Item -ItemType Directory -Path $PromptRoot -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $OriginalCopy.FullName "*") -Destination $PromptRoot -Recurse -Force
} else {
    $NotExisted = Join-Path $BeforePromptRoot "PROMPT_ROOT_NOT_EXISTED.txt"
    if (Test-Path -LiteralPath $NotExisted) {
        Write-Host "元のプロンプトルートは存在しなかったため、削除状態へ戻しました。"
    }
}

Write-Host "OK: 3段階AI外部プロンプト作成前へ戻しました。"
