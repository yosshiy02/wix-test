# ==============================
# UNDO 支払書類取込システム骨格
# ==============================

$ErrorActionPreference = "Stop"

function Restore-IfExists {
  param([string]$Before, [string]$Target)
  if (Test-Path -LiteralPath $Before) {
    Copy-Item -LiteralPath $Before -Destination $Target -Force
    Write-Host "RESTORED: $Target"
  }
}

Restore-IfExists "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payable-list.html" "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payable-list.html"
Restore-IfExists "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payable-list.css" "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payable-list.css"
Restore-IfExists "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\server.js" "G:\GITHUB\wix-test\hd-origin-project\web_receiver\server.js"

$RoutePath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js"
$InboxHtmlPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-inbox.html"

if (Test-Path -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes.js") {
  Restore-IfExists "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes.js" $RoutePath
} elseif (Test-Path -LiteralPath $RoutePath) {
  Remove-Item -LiteralPath $RoutePath -Force
  Write-Host "REMOVED: $RoutePath"
}

if (Test-Path -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox.html") {
  Restore-IfExists "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-inbox.html" $InboxHtmlPath
} elseif (Test-Path -LiteralPath $InboxHtmlPath) {
  Remove-Item -LiteralPath $InboxHtmlPath -Force
  Write-Host "REMOVED: $InboxHtmlPath"
}

Write-Host "OK: 支払書類取込システム骨格をUNDOしました。"