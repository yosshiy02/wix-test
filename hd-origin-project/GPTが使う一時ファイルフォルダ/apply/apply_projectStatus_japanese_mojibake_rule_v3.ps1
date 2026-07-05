$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"

Copy-Item (Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\src\projectStatus.js") (Join-Path $ProjectRoot "web_receiver\src\projectStatus.js") -Force

Write-Host "反映しました: スタート文書へ日本語文字化け・Node日本語パス注意を追記 v3"
