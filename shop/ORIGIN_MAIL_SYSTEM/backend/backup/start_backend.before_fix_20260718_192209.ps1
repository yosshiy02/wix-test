$ErrorActionPreference = "Stop"

$BackendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $BackendRoot

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "HD ORGIN STYLE MAIL SYSTEM BACKEND" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

node --version

if ($LASTEXITCODE -ne 0) {
    throw "Node.jsを実行できません。"
}

node --check ".\src\server.js"

if ($LASTEXITCODE -ne 0) {
    throw "server.jsの構文確認に失敗しました。"
}

Write-Host ""
Write-Host "API=http://127.0.0.1:3210/api/health" -ForegroundColor Green
Write-Host ""

node ".\src\server.js"