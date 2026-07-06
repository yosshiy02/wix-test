Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue
$ErrorActionPreference = "Stop"
$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$NodePath = "G:\Apps\NodeJS\node.exe"
$BeforeServer = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\server_before_startup_restore_pc_change_20260706_234458.js"
$TargetServer = Join-Path $ProjectRoot "web_receiver\server.js"
if (-not (Test-Path -LiteralPath $BeforeServer)) {
  throw "before server.js が見つかりません: $BeforeServer"
}
Copy-Item -LiteralPath $BeforeServer -Destination $TargetServer -Force
$Check = & $NodePath --check $TargetServer 2>&1
$CheckText = ($Check | Out-String).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "UNDO後の server.js 構文チェックに失敗しました: $CheckText"
}
Write-Host "OK: server.js を修正前に戻しました。"
Write-Host "対象: $TargetServer"
