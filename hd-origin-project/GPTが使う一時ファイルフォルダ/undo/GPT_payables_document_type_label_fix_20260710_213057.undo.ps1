$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project"
$SourceFile = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\GPT_payables_document_type_label_fix_20260710_213057.before.payable-list.html"
$TargetFile = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"

if (-not (Test-Path -LiteralPath $SourceFile)) {
    throw "beforeファイルが見つかりません。"
}

Copy-Item -LiteralPath $SourceFile -Destination $TargetFile -Force

Write-Host "UNDO成功"
Write-Host "Git操作: 未実施"
Write-Host "サーバー再起動: 不要"
Write-Host "GPT2側: 未使用"