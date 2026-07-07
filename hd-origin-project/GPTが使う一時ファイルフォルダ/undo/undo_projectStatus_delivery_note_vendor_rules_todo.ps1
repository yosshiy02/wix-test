# ==============================
# UNDO projectStatus.js 納品書AI取引先別ルールTODO恒久追記
# ==============================

$ErrorActionPreference = "Stop"

$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\projectStatus.js"
$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\projectStatus.js"

if (-not (Test-Path -LiteralPath $Before)) {
  throw "beforeファイルが見つかりません: $Before"
}

Copy-Item -LiteralPath $Before -Destination $Target -Force
Write-Host "OK: projectStatus.js をbeforeへ戻しました。"