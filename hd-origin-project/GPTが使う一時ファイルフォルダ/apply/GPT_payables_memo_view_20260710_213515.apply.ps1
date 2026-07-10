$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project"

$AfterHtml = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\GPT_payables_memo_view_20260710_213515.after.payable-list.html"
$AfterCss  = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\GPT_payables_memo_view_20260710_213515.after.payable-list.css"

$TargetHtml = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
$TargetCss  = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.css"

if (-not (Test-Path -LiteralPath $AfterHtml)) {
    throw "after HTMLが見つかりません。"
}

if (-not (Test-Path -LiteralPath $AfterCss)) {
    throw "after CSSが見つかりません。"
}

$Html = [System.IO.File]::ReadAllText($AfterHtml)

$Matches = [regex]::Matches(
    $Html,
    '(?is)<script(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>'
)

$Combined = New-Object System.Text.StringBuilder

foreach ($Match in $Matches) {
    [void]$Combined.AppendLine(
        $Match.Groups[1].Value
    )
}

$TempJs = Join-Path $env:TEMP "payable-memo-apply-check.js"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

try {
    [System.IO.File]::WriteAllText(
        $TempJs,
        $Combined.ToString(),
        $Utf8NoBom
    )

    node --check $TempJs

    if ($LASTEXITCODE -ne 0) {
        throw "反映前構文確認に失敗しました。"
    }
}
finally {
    Remove-Item -LiteralPath $TempJs -Force -ErrorAction SilentlyContinue
}

Copy-Item -LiteralPath $AfterHtml -Destination $TargetHtml -Force
Copy-Item -LiteralPath $AfterCss  -Destination $TargetCss  -Force

Write-Host "=========================================="
Write-Host "反映成功"
Write-Host "=========================================="
Write-Host "追加: 全件メモ / 単品メモ"
Write-Host "Git操作: 未実施"
Write-Host "サーバー再起動: 不要"
Write-Host "GPT2側: 未使用"