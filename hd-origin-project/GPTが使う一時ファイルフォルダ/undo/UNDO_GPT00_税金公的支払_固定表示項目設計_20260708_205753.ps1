$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$TargetHtml = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-tax-public.html"
$TargetCss  = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-tax-public.css"
$BeforeHtml = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\payment-document-specialist-tax-public.before_20260708_205753.html"
$BeforeCss  = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\payment-document-specialist-tax-public.before_20260708_205753.css"

Copy-Item -LiteralPath $BeforeHtml -Destination $TargetHtml -Force
Copy-Item -LiteralPath $BeforeCss  -Destination $TargetCss  -Force

Write-Host "OK: 税金・公的支払専門解析システムのHTML/CSSを修正前へ戻しました。"
Write-Host "HTML: $TargetHtml"
Write-Host "CSS : $TargetCss"
