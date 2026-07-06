Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue
$ErrorActionPreference = "Stop"
$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$NodePath = "G:\Apps\NodeJS\node.exe"
$AfterHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\payable-list_after_delivery_note_button_20260706_235835.html"
$AfterRepo = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\payables.repository_after_delivery_note_button_20260706_235835.js"
$TargetHtml = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
$TargetRepo = Join-Path $ProjectRoot "web_receiver\src\payables\payables.repository.js"
if (-not (Test-Path -LiteralPath $AfterHtml)) {
  throw "after HTML が見つかりません: $AfterHtml"
}
if (-not (Test-Path -LiteralPath $AfterRepo)) {
  throw "after repository が見つかりません: $AfterRepo"
}
$RepoCheck = & $NodePath --check $AfterRepo 2>&1
$RepoCheckText = ($RepoCheck | Out-String).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "after repository の構文チェックに失敗しました: $RepoCheckText"
}
Copy-Item -LiteralPath $AfterHtml -Destination $TargetHtml -Force
Copy-Item -LiteralPath $AfterRepo -Destination $TargetRepo -Force
$RepoCheck2 = & $NodePath --check $TargetRepo 2>&1
$RepoCheckText2 = ($RepoCheck2 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "本体 repository 反映後の構文チェックに失敗しました: $RepoCheckText2"
}
Write-Host "OK: 請求書・未払管理画面に納品書ボタンを反映しました。"
Write-Host "HTML: $TargetHtml"
Write-Host "Repo: $TargetRepo"
Write-Host ""
Write-Host "反映後は画面を再読み込みしてください。"
