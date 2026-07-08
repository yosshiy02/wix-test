$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$TargetHtml = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-tax-public.html"
$TargetCss  = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-tax-public.css"
$AfterHtml  = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\payment-document-specialist-tax-public.after_20260708_205753.html"
$AfterCss   = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\payment-document-specialist-tax-public.after_20260708_205753.css"

Copy-Item -LiteralPath $AfterHtml -Destination $TargetHtml -Force
Copy-Item -LiteralPath $AfterCss  -Destination $TargetCss  -Force

Write-Host "OK: 税金・公的支払専門解析システムの固定表示項目HTML/CSSを本体へ反映しました。"
Write-Host "HTML: $TargetHtml"
Write-Host "CSS : $TargetCss"
