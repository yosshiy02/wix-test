$ServerTarget = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\server.js"
$ReceiptTarget = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"
$RestartBatTarget = "G:\GITHUB\wix-test\hd-origin-project\restart_hd_origin.bat"

$BeforeServer = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\server_before_restart_button_20260705_110700.js"
$BeforeReceipt = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_restart_button_20260705_110700.html"
$BeforeRestartBat = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\restart_hd_origin_before_restart_button_20260705_110700.bat"

Copy-Item -LiteralPath $BeforeServer -Destination $ServerTarget -Force
Copy-Item -LiteralPath $BeforeReceipt -Destination $ReceiptTarget -Force

$Marker = Get-Content -LiteralPath $BeforeRestartBat -Raw -Encoding UTF8
if ($Marker -eq "NO_EXISTING_RESTART_BAT") {
  if (Test-Path -LiteralPath $RestartBatTarget) {
    Remove-Item -LiteralPath $RestartBatTarget -Force
  }
} else {
  Copy-Item -LiteralPath $BeforeRestartBat -Destination $RestartBatTarget -Force
}

$NodePath = "G:\Apps\NodeJS\node.exe"
if (Test-Path -LiteralPath $NodePath) {
  & $NodePath --check $ServerTarget
} else {
  node --check $ServerTarget
}
