$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\paymentDocuments.aiPromptLoader.before_3stage_20260708_214709.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.aiPromptLoader.js" -Force

Write-Host "OK: paymentDocuments.aiPromptLoader.js を3段階対応前へ戻しました。"
