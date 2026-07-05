Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.repository.before_new6_tax_breakdowns_api.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.repository.js" -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.routes.before_new6_tax_breakdowns_api.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.routes.js" -Force
node --check "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.repository.js"
node --check "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.routes.js"
