$ErrorActionPreference = "Stop"

$Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\paymentDocuments.routes.js"
$AfterFile = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\GPT00_routes_analysis_system_AI返却値DB列保存_20260709_113508.after.js"

if (-not (Test-Path -LiteralPath $AfterFile)) {
  throw "afterファイルが見つかりません: $AfterFile"
}

Copy-Item -LiteralPath $AfterFile -Destination $Target -Force

Write-Host "OK: AIが返した analysis_system_* をDB列へ保存するマッピングを反映しました。"
Write-Host "反映先: $Target"
Write-Host "注意: routes.js 修正なので、サーバー再起動後に有効になります。"
