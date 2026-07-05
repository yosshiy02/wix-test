$HtmlPath = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.html"
$CssPath  = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.css"
$AiPath   = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.ai.js"

$BeforeHtml = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_line_tax_treatment_20260705_082953.html"
$BeforeCss  = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\public\receipts\receipt-list_before_line_tax_treatment_20260705_082953.css"
$BeforeAi   = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.ai_before_line_tax_treatment_20260705_082953.js"

if (-not (Test-Path -LiteralPath $BeforeHtml)) { throw "before HTML not found: $BeforeHtml" }
if (-not (Test-Path -LiteralPath $BeforeCss))  { throw "before CSS not found: $BeforeCss" }
if (-not (Test-Path -LiteralPath $BeforeAi))   { throw "before AI not found: $BeforeAi" }

Copy-Item -LiteralPath $BeforeHtml -Destination $HtmlPath -Force
Copy-Item -LiteralPath $BeforeCss  -Destination $CssPath  -Force
Copy-Item -LiteralPath $BeforeAi   -Destination $AiPath   -Force

Write-Host "OK: restored receipt-list.html, receipt-list.css, receipts.ai.js"