$ServerTarget = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\server.js"
$ReceiptTarget = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"
$RestartBatTarget = "G:\GITHUB\wix-test\hd-origin-project\restart_hd_origin.bat"

$AfterServer = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\server.js"
$AfterReceipt = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.html"
$AfterRestartBat = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\restart_hd_origin.bat"

Copy-Item -LiteralPath $AfterServer -Destination $ServerTarget -Force
Copy-Item -LiteralPath $AfterReceipt -Destination $ReceiptTarget -Force
Copy-Item -LiteralPath $AfterRestartBat -Destination $RestartBatTarget -Force

$NodePath = "G:\Apps\NodeJS\node.exe"
if (Test-Path -LiteralPath $NodePath) {
  & $NodePath --check $ServerTarget
} else {
  node --check $ServerTarget
}
