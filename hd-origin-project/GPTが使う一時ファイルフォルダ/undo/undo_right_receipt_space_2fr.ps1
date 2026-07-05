$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Before = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_right_receipt_space_2fr.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"

if (!(Test-Path $Before)) {
    throw "beforeファイルがありません: $Before"
}

Copy-Item $Before $Target -Force

Write-Host "OK: 右レシート表示スペース2fr化の前に戻しました。"
