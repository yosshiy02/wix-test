$ErrorActionPreference = "Stop"
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_main_business_flow_button_20260709_194022.before.index.html" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\index.html" -Force

if ("False" -eq "True") {
  Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\GPT2_business_flow_settings_20260709_194022.before.html" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\settings\business-flow-settings.html" -Force
} else {
  if (Test-Path -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\settings\business-flow-settings.html") {
    Remove-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\settings\business-flow-settings.html" -Force
  }
}

Write-Host "UNDO完了: メイン画面の業務フロー設定ボタン追加を戻しました。"
