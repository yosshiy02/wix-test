$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$After = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"

if (!(Test-Path $After)) {
    throw "afterファイルがありません: $After"
}

Copy-Item $After $Target -Force

Write-Host "OK: 左選択 / 中編集 / 右レシート表示 の順で、右レシート表示スペースを2fr化しました。"
