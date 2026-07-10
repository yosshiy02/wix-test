$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project"
$SourceFile = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\GPT_payables_initial_load_fix_20260710_212732.after.payable-list.html"
$TargetFile = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"

if (-not (Test-Path -LiteralPath $SourceFile)) {
    throw "afterファイルが見つかりません。"
}

if (-not (Test-Path -LiteralPath $TargetFile)) {
    throw "対象HTMLが見つかりません。"
}

$Text = [System.IO.File]::ReadAllText($SourceFile)

$Matches = [regex]::Matches(
    $Text,
    '(?is)<script(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>'
)

$Combined = New-Object System.Text.StringBuilder

foreach ($Match in $Matches) {
    [void]$Combined.AppendLine($Match.Groups[1].Value)
}

$TempJs = Join-Path $env:TEMP "payable-list-apply-check.js"
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

Copy-Item `
    -LiteralPath $SourceFile `
    -Destination $TargetFile `
    -Force

Write-Host "=========================================="
Write-Host "反映成功"
Write-Host "=========================================="
Write-Host "未払一覧はマスタ読込失敗時も読み込みます。"
Write-Host "Git操作: 未実施"
Write-Host "サーバー再起動: 不要"
Write-Host "GPT2側: 未使用"