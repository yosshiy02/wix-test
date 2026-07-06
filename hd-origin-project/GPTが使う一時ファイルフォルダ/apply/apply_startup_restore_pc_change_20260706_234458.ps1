Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue
$ErrorActionPreference = "Stop"
$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$NodePath = "G:\Apps\NodeJS\node.exe"
$AfterServer = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\server_after_startup_restore_pc_change_20260706_234458.js"
$TargetServer = Join-Path $ProjectRoot "web_receiver\server.js"
if (-not (Test-Path -LiteralPath $AfterServer)) {
  throw "after server.js が見つかりません: $AfterServer"
}
$Check = & $NodePath --check $AfterServer 2>&1
$CheckText = ($Check | Out-String).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "after server.js の構文チェックに失敗しました: $CheckText"
}
Copy-Item -LiteralPath $AfterServer -Destination $TargetServer -Force
$Check2 = & $NodePath --check $TargetServer 2>&1
$CheckText2 = ($Check2 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "本体 server.js 反映後の構文チェックに失敗しました: $CheckText2"
}
Write-Host "OK: server.js に PC変更時のみ最新版リストア確認を反映しました。"
Write-Host "対象: $TargetServer"
Write-Host "記録ファイル: $ProjectRoot\HD_ORIGIN_LAST_RESTORE_CHECK_PC.txt"
Write-Host ""
Write-Host "次回起動時、PCが変わった場合のみ黒い画面で2回確認が出ます。"
