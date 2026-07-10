$ErrorActionPreference = "Stop"

$NodePath = "C:\Program Files\nodejs\node.exe"

$Start = Get-Location
$ProjectRoot = $null
$Cursor = $Start.Path

while ($Cursor) {
    $Candidate = Join-Path $Cursor "web_receiver\src\paymentDocuments\paymentDocuments.routes.js"

    if (Test-Path -LiteralPath $Candidate) {
        $ProjectRoot = $Cursor
        break
    }

    $Parent = Split-Path -Parent $Cursor

    if (-not $Parent -or $Parent -eq $Cursor) {
        break
    }

    $Cursor = $Parent
}

if (-not $ProjectRoot) {
    throw "PROJECT_ROOTを確認できません。hd-origin-project内で実行してください。"
}

$Gpt2Root = Get-ChildItem -LiteralPath $ProjectRoot -Directory |
    Where-Object { $_.Name -like "GPT2*一時ファイルフォルダ*" } |
    Select-Object -First 1

if (-not $Gpt2Root) {
    throw "GPT2一時フォルダが見つかりません。"
}

$Before = Get-ChildItem -LiteralPath (Join-Path $Gpt2Root.FullName "before") `
    -Filter "paymentDocuments.routes.before_specialist_parent_auto_*.js" `
    -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $Before) {
    throw "専門保存APIのbeforeファイルが見つかりません。"
}

$Target = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\paymentDocuments.routes.js"

& $NodePath --check $Before.FullName

if ($LASTEXITCODE -ne 0) {
    throw "beforeの構文確認に失敗したため戻しません。"
}

Copy-Item -LiteralPath $Before.FullName -Destination $Target -Force

& $NodePath --check $Target

if ($LASTEXITCODE -ne 0) {
    throw "UNDO後の構文確認に失敗しました。"
}

Write-Host ""
Write-Host "UNDO成功" -ForegroundColor Green
Write-Host "Git操作・サーバー再起動はしていません。"