$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$BeforeHtml = Join-Path $TempRoot "before\web_receiver\public\payables\payable-list_before_split_css_20260706_205252.html"
$BeforeCss = Join-Path $TempRoot "before\web_receiver\public\payables\payable-list_before_split_css_20260706_205252.css"
$TargetHtml = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
$TargetCss = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.css"
Copy-Item -LiteralPath $BeforeHtml -Destination $TargetHtml -Force
$HadCssBefore = $False
if ($HadCssBefore) {
  Copy-Item -LiteralPath $BeforeCss -Destination $TargetCss -Force
} else {
  Remove-Item -LiteralPath $TargetCss -Force -ErrorAction SilentlyContinue
}
Write-Host "OK: 請求書・未払管理画面のHTML/CSS分離をUNDOしました。"