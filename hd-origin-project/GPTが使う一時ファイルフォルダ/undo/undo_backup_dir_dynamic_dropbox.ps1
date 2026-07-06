$ProjectRoot = "D:\GITHUB\wix-test\hd-origin-project"
Copy-Item -LiteralPath (Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\start_hd_origin.bat") -Destination (Join-Path $ProjectRoot "web_receiver\start_hd_origin.bat") -Force
Copy-Item -LiteralPath (Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\config.js") -Destination (Join-Path $ProjectRoot "web_receiver\src\config.js") -Force
Write-Host "OK: start_hd_origin.bat / src\config.js を元に戻しました。"
