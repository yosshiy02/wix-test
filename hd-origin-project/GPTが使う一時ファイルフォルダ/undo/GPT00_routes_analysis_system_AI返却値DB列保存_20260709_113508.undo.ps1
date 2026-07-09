$ErrorActionPreference = "Stop"

$Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js"
$BeforeFile = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT00_routes_analysis_system_AI返却値DB列保存_20260709_113508.before.js"

if (-not (Test-Path -LiteralPath $BeforeFile)) {
  throw "beforeファイルが見つかりません: $BeforeFile"
}

Copy-Item -LiteralPath $BeforeFile -Destination $Target -Force

Write-Host "UNDO完了: analysis_system_* DB列保存マッピング修正前へ戻しました。"
Write-Host "反映先: $Target"
Write-Host "注意: routes.js 修正なので、サーバー再起動後に有効になります。"
