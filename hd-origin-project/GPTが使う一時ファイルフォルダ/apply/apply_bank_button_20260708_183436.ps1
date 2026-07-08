$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\bank" | Out-Null
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\index.after_bank_button_20260708_183436.html" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\index.html" -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\bank-dashboard.after_bank_button_20260708_183436.html" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\bank\bank-dashboard.html" -Force
Write-Host "OK: メイン画面に銀行業務ボタンを追加し、銀行業務ページを作成しました。"
