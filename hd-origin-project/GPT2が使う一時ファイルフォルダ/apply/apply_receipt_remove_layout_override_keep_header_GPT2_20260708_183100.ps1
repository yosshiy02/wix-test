$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\after\receipt-list.css.after_receipt_remove_layout_override_keep_header_GPT2_20260708_183100" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\receipts\receipt-list.css" -Force
Write-Host "OK: レシート画面のレイアウト崩れ原因CSSを撤去し、ヘッダー見た目だけ残しました。"
