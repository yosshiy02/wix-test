$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$AfterHtml = Join-Path $TempRoot "after\web_receiver\public\payables\payable-list_after_left_small_font_20260706_213457.html"
$AfterCss = Join-Path $TempRoot "after\web_receiver\public\payables\payable-list_after_left_small_font_20260706_213457.css"
$TargetHtml = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
$TargetCss = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.css"
Copy-Item -LiteralPath $AfterHtml -Destination $TargetHtml -Force
if (Test-Path -LiteralPath $AfterCss) {
  Copy-Item -LiteralPath $AfterCss -Destination $TargetCss -Force
}
Write-Host "OK: 請求書・未払管理の左側フォント小さめ調整を再反映しました。"