$ErrorActionPreference = 'Stop'
Copy-Item -LiteralPath 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\paymentDocuments\paymentDocuments.routes_after_tax_payment_rule_fallback_20260707_180515.js' -Destination 'C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js' -Force
Write-Host 'OK: paymentDocuments.routes.js に納付書ルール補正を反映しました。'
