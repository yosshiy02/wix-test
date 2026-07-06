Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue
$ErrorActionPreference = "Stop"
$BeforeHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\payable-list_before_real_delivery_note_button_20260707_000910.html"
$BeforeRepo = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\payables.repository_before_real_delivery_note_button_20260707_000910.js"
$HtmlPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payable-list.html"
$RepoPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\payables\payables.repository.js"
$NodePath = "G:\Apps\NodeJS\node.exe"
Copy-Item -LiteralPath $BeforeHtml -Destination $HtmlPath -Force
Copy-Item -LiteralPath $BeforeRepo -Destination $RepoPath -Force
$Check = & $NodePath --check $RepoPath 2>&1
$CheckText = ($Check | Out-String).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "UNDO後のRepo構文チェックに失敗しました: $CheckText"
}
Write-Host "OK: 本物の納品書ボタン修正前に戻しました。"
