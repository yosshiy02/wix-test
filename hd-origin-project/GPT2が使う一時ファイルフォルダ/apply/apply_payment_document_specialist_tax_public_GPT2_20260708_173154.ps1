$ErrorActionPreference = "Stop"
try { Set-PSReadLineOption -HistorySaveStyle SaveNothing } catch {}

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\after\web_receiver\public\payables\payment-document-specialist-tax-public.html" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-tax-public.html" -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\after\web_receiver\public\payables\payment-document-specialist-tax-public.css" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-tax-public.css" -Force

Write-Host "OK: 税金・公的支払専門解析ページを本体へ反映しました。"
Write-Host "HTML: C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-tax-public.html"
Write-Host "CSS : C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-tax-public.css"
