$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"

Copy-Item (Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\projectStatus_before_japanese_mojibake_rule_v3.js") (Join-Path $ProjectRoot "web_receiver\src\projectStatus.js") -Force

Write-Host "UNDOしました: スタート文書 日本語文字化け・Node日本語パス注意追記 v3"
