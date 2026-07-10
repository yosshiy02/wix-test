$ErrorActionPreference = "Stop"

function Find-ProjectRoot {
    param([string]$StartPath)

    $Current = [System.IO.Path]::GetFullPath($StartPath)

    while ($true) {
        if (
            (Test-Path -LiteralPath (Join-Path $Current "web_receiver\server.js")) -and
            (Test-Path -LiteralPath (Join-Path $Current "GPTが使う一時ファイルフォルダ"))
        ) {
            return $Current
        }

        $Parent = Split-Path -Parent $Current

        if (
            [string]::IsNullOrWhiteSpace($Parent) -or
            $Parent -eq $Current
        ) {
            return $null
        }

        $Current = $Parent
    }
}

$ProjectRoot = Find-ProjectRoot -StartPath (Get-Location).Path

if (-not $ProjectRoot) {
    throw "PROJECT_ROOTを検出できません。"
}

$SourceFile = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\GPT_payable_control_save_fix_20260710_205846.after.payables.repository.js"
$TargetFile = Join-Path $ProjectRoot "web_receiver\src\payables\payables.repository.js"

if (-not (Test-Path -LiteralPath $SourceFile)) {
    throw "afterファイルが見つかりません: $SourceFile"
}

if (-not (Test-Path -LiteralPath $TargetFile)) {
    throw "本体ファイルが見つかりません: $TargetFile"
}

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue

if (-not $NodeCommand) {
    throw "node.exeを検出できません。"
}

& $NodeCommand.Source --check $SourceFile

if ($LASTEXITCODE -ne 0) {
    throw "afterファイルの構文確認に失敗しました。本体は未変更です。"
}

Copy-Item `
    -LiteralPath $SourceFile `
    -Destination $TargetFile `
    -Force

& $NodeCommand.Source --check $TargetFile

if ($LASTEXITCODE -ne 0) {
    throw "反映後の本体構文確認に失敗しました。undoを実行してください。"
}

Write-Host "=========================================="
Write-Host "反映成功"
Write-Host "=========================================="
Write-Host "対象: web_receiver\src\payables\payables.repository.js"
Write-Host "修正: WHERE payable_id = `$1"
Write-Host "Git操作: 未実施"
Write-Host "サーバー再起動: 未実施"