Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.repository.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.repository.js" -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.routes.js" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.routes.js" -Force
node --check "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.repository.js"
node --check "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.routes.js"
