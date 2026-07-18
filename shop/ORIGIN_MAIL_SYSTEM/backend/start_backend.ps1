$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$BackendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerFile = Join-Path $BackendRoot "src\server.js"

Set-Location -LiteralPath $BackendRoot

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "HD ORGIN STYLE MAIL SYSTEM BACKEND" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$NodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue

if ($null -eq $NodeCommand) {
    $NodeCommand = Get-Command "node" -ErrorAction SilentlyContinue
}

if ($null -eq $NodeCommand) {
    throw "Node.jsが見つかりません。"
}

$NodePath = $NodeCommand.Source

if ([string]::IsNullOrWhiteSpace($NodePath)) {
    $NodePath = $NodeCommand.Path
}

if ([string]::IsNullOrWhiteSpace($NodePath)) {
    throw "Node.jsの実行パスを取得できません。"
}

Write-Host "NODE_PATH=$NodePath"
Write-Host "SERVER_FILE=$ServerFile"

Write-Host ""
Write-Host "Node.jsバージョン確認" -ForegroundColor Yellow

& $NodePath "--version"

if ($LASTEXITCODE -ne 0) {
    throw "Node.jsのバージョン確認に失敗しました。"
}

Write-Host ""
Write-Host "server.js構文確認" -ForegroundColor Yellow

& $NodePath "--check" $ServerFile

if ($LASTEXITCODE -ne 0) {
    throw "server.jsの構文確認に失敗しました。"
}

Write-Host ""
Write-Host "構文確認成功" -ForegroundColor Green
Write-Host "API=http://127.0.0.1:3210/api/health"
Write-Host "終了する場合は Ctrl+C を押してください。"
Write-Host ""

& $NodePath $ServerFile

if ($LASTEXITCODE -ne 0) {
    throw "バックエンドサーバーが異常終了しました。EXIT_CODE=$LASTEXITCODE"
}