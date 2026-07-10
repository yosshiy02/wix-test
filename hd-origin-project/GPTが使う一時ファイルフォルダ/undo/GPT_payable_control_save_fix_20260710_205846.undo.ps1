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

$SourceFile = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\GPT_payable_control_save_fix_20260710_205846.before.payables.repository.js"
$TargetFile = Join-Path $ProjectRoot "web_receiver\src\payables\payables.repository.js"

if (-not (Test-Path -LiteralPath $SourceFile)) {
    throw "beforeファイルが見つかりません: $SourceFile"
}

Copy-Item `
    -LiteralPath $SourceFile `
    -Destination $TargetFile `
    -Force

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue

if (-not $NodeCommand) {
    throw "node.exeを検出できません。復元は完了しましたが、構文確認できません。"
}

& $NodeCommand.Source --check $TargetFile

if ($LASTEXITCODE -ne 0) {
    throw "UNDO後の構文確認に失敗しました。"
}

Write-Host "=========================================="
Write-Host "UNDO成功"
Write-Host "=========================================="
Write-Host "対象: web_receiver\src\payables\payables.repository.js"
Write-Host "Git操作: 未実施"
Write-Host "サーバー再起動: 未実施"