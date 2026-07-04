$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Source = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\public\settings.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\settings.html"
Copy-Item -Path $Source -Destination $Target -Force
Write-Host "APPLY OK: settings.html をバックアップ構造/データ分離表示版に反映しました。"
