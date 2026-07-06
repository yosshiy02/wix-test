$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$BeforeHtml = Join-Path $TempRoot "before\web_receiver\public\payables\payable-list_before_font_large_20260706_212952.html"
$BeforeCss = Join-Path $TempRoot "before\web_receiver\public\payables\payable-list_before_font_large_20260706_212952.css"
$TargetHtml = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
$TargetCss = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.css"
Copy-Item -LiteralPath $BeforeHtml -Destination $TargetHtml -Force
$HadCssFile = $True
if ($HadCssFile) {
  Copy-Item -LiteralPath $BeforeCss -Destination $TargetCss -Force
} else {
  Remove-Item -LiteralPath $TargetCss -Force -ErrorAction SilentlyContinue
}
Write-Host "OK: 請求書・未払管理のフォント全体拡大をUNDOしました。"