$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Before = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_editor_card_layout.ps1.html"
$Target = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"

if (!(Test-Path $Before)) {
    throw "beforeファイルがありません: $Before"
}

Copy-Item $Before $Target -Force

Write-Host "OK: レシート読取確認ページを修正前に戻しました。"
