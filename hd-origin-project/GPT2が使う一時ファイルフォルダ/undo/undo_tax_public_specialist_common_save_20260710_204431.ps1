$ErrorActionPreference = "Stop"

$BeforeHtml = @'
C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\payment-document-specialist-tax-public.before_specialist_common_save_20260710_204431.html
'@

$HtmlPath = @'
C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-tax-public.html
'@

Copy-Item -LiteralPath $BeforeHtml -Destination $HtmlPath -Force
Write-Host "OK"