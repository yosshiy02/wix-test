$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$AfterHtml = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.html"
$AfterCss  = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.css"
$DestHtml  = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"
$DestCss   = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.css"

if (-not (Test-Path -LiteralPath $AfterHtml)) { throw "after HTML not found: $AfterHtml" }
if (-not (Test-Path -LiteralPath $AfterCss)) { throw "after CSS not found: $AfterCss" }

Copy-Item -LiteralPath $AfterHtml -Destination $DestHtml -Force
Copy-Item -LiteralPath $AfterCss  -Destination $DestCss  -Force

Write-Host "OK: applied receipt-list.html and receipt-list.css"