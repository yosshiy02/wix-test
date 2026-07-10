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
    throw "PROJECT_ROOTを実行場所から確認できません。hd-origin-project内で実行してください。"
}

$Gpt2Root = Get-ChildItem -LiteralPath $ProjectRoot -Directory |
    Where-Object { $_.Name -like "GPT2*一時ファイルフォルダ*" } |
    Select-Object -First 1

if (-not $Gpt2Root) {
    throw "GPT2一時フォルダが見つかりません。"
}

$After = Get-ChildItem -LiteralPath (Join-Path $Gpt2Root.FullName "after") `
    -Filter "paymentDocuments.routes.after_specialist_parent_auto_*.js" `
    -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $After) {
    throw "専門保存APIのafterファイルが見つかりません。"
}

$Target = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\paymentDocuments.routes.js"

& $NodePath --check $After.FullName

if ($LASTEXITCODE -ne 0) {
    throw "afterの構文確認に失敗したため反映しません。"
}

Copy-Item -LiteralPath $After.FullName -Destination $Target -Force

& $NodePath --check $Target

if ($LASTEXITCODE -ne 0) {
    throw "本体反映後の構文確認に失敗しました。undoを実行してください。"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "専門保存API 反映成功" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Git操作はしていません。"
Write-Host "サーバー再起動はしていません。"