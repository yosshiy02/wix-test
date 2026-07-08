$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\index.before_bank_button_20260708_183436.html" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\index.html" -Force
if (Test-Path -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\bank\bank-dashboard.html") {
    Remove-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\bank\bank-dashboard.html" -Force
}
Write-Host "OK: 銀行業務ボタン追加前へ戻しました。"
