$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\bank_category_master_split_income_outgoing_20260708_194210\web_receiver\public\bank\bank-category-master.html" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\bank\bank-category-master.html" -Force
Write-Host "OK: 銀行業務 区分マスタを入金系・出金系に分離して整理しました。"
