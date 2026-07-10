$ErrorActionPreference = "Stop"

Copy-Item "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT_payable_control_B_20260710_204332.before.payable-list.html" "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payable-list.html" -Force
Copy-Item "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT_payable_control_B_20260710_204332.before.payable-list.css" "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payable-list.css" -Force

Write-Host "画面UNDO完了"