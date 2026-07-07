$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\rules\sorting.extra-rules_before_public_utility_boundary_20260708_015121.txt" -Destination "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\prompts\sorting.extra-rules.txt" -Force
Write-Host "UNDO完了: sorting.extra-rules.txt を公共料金境界ルール追加前に戻しました。"
