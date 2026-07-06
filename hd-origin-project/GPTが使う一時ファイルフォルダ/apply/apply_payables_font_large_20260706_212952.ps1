$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$AfterHtml = Join-Path $TempRoot "after\web_receiver\public\payables\payable-list_after_font_large_20260706_212952.html"
$AfterCss = Join-Path $TempRoot "after\web_receiver\public\payables\payable-list_after_font_large_20260706_212952.css"
$TargetHtml = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
$TargetCss = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.css"
Copy-Item -LiteralPath $AfterHtml -Destination $TargetHtml -Force
if (Test-Path -LiteralPath $AfterCss) {
  Copy-Item -LiteralPath $AfterCss -Destination $TargetCss -Force
}
Write-Host "OK: 請求書・未払管理のフォント全体拡大を再反映しました。"