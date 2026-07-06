$ErrorActionPreference = "Stop"
$TempRoot = Split-Path $PSScriptRoot -Parent
$ProjectRoot = Split-Path $TempRoot -Parent
$IndexPath = Join-Path $ProjectRoot "web_receiver\public\index.html"
$PayablesPath = Join-Path $ProjectRoot "web_receiver\public\payables\payable-list.html"
$BeforeIndexPath = Join-Path $TempRoot "before\web_receiver\public\index_before_payables_button_20260706_202133.html"
Copy-Item -LiteralPath $BeforeIndexPath -Destination $IndexPath -Force
$HadPayablesBefore = $False
if ($HadPayablesBefore) {
  $BeforePayablesPath = Join-Path $TempRoot "before\web_receiver\public\payables\"
  Copy-Item -LiteralPath $BeforePayablesPath -Destination $PayablesPath -Force
} else {
  if (Test-Path -LiteralPath $PayablesPath) {
    Remove-Item -LiteralPath $PayablesPath -Force
  }
}
Write-Host "OK: 請求書・未払管理ボタン追加をUNDOしました。"
