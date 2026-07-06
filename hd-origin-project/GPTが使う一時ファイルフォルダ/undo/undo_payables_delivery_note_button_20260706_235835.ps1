Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue
$ErrorActionPreference = "Stop"
$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$NodePath = "G:\Apps\NodeJS\node.exe"
$BeforeHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\payable-list_before_delivery_note_button_20260706_235835.html"
$BeforeRepo = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\payables.repository_before_delivery_note_button_20260706_235835.js"
$TargetHtml = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
$TargetRepo = Join-Path $ProjectRoot "web_receiver\src\payables\payables.repository.js"
if (-not (Test-Path -LiteralPath $BeforeHtml)) {
  throw "before HTML が見つかりません: $BeforeHtml"
}
if (-not (Test-Path -LiteralPath $BeforeRepo)) {
  throw "before repository が見つかりません: $BeforeRepo"
}
Copy-Item -LiteralPath $BeforeHtml -Destination $TargetHtml -Force
Copy-Item -LiteralPath $BeforeRepo -Destination $TargetRepo -Force
$RepoCheck = & $NodePath --check $TargetRepo 2>&1
$RepoCheckText = ($RepoCheck | Out-String).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "UNDO後 repository の構文チェックに失敗しました: $RepoCheckText"
}
Write-Host "OK: 納品書ボタン修正前に戻しました。"
Write-Host "HTML: $TargetHtml"
Write-Host "Repo: $TargetRepo"
