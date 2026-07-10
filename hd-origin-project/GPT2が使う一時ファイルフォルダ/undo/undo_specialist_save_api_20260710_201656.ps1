$ErrorActionPreference = "Stop"

Copy-Item -LiteralPath "C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project\\GPT2が使う一時ファイルフォルダ\\before\\paymentDocuments.routes.before_specialist_save_api_20260710_201656.js" -Destination "C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project\\web_receiver\\src\\paymentDocuments\\paymentDocuments.routes.js" -Force

Write-Host "OK: paymentDocuments.routes.js を専門解析保存API追加前に戻しました。"