$ErrorActionPreference = "Stop"

Set-Location -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\GPTに渡すフォルダ"

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\payment-document-specialist-invoice-payable.before_GPT2_20260708_171659.html" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\GPTに渡すフォルダ\web_receiver\public\payables\payment-document-specialist-invoice-payable.html" -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\payment-document-specialist-invoice-payable.before_GPT2_20260708_171659.css" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\GPTに渡すフォルダ\web_receiver\public\payables\payment-document-specialist-invoice-payable.css" -Force

Write-Host "OK: GPT2側の請求・未払系専門解析ページを作成前へ戻しました。"
