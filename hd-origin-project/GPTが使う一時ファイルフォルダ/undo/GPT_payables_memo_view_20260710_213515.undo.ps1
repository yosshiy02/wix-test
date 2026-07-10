$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project"

$BeforeHtml = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\GPT_payables_memo_view_20260710_213515.before.payable-list.html"
$BeforeCss  = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\GPT_payables_memo_view_20260710_213515.before.payable-list.css"

$TargetHtml = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
$TargetCss  = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.css"

if (-not (Test-Path -LiteralPath $BeforeHtml)) {
    throw "before HTMLが見つかりません。"
}

if (-not (Test-Path -LiteralPath $BeforeCss)) {
    throw "before CSSが見つかりません。"
}

Copy-Item -LiteralPath $BeforeHtml -Destination $TargetHtml -Force
Copy-Item -LiteralPath $BeforeCss  -Destination $TargetCss  -Force

Write-Host "=========================================="
Write-Host "UNDO成功"
Write-Host "=========================================="
Write-Host "Git操作: 未実施"
Write-Host "サーバー再起動: 不要"
Write-Host "GPT2側: 未使用"