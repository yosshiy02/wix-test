$ErrorActionPreference = "Stop"

$Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-utility-communication.html"
$Before = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\payment-document-specialist-utility-communication.before_resolved_id_20260710_215002.html"

if (-not (Test-Path -LiteralPath $Before)) {
    throw "before file not found."
}

Copy-Item -LiteralPath $Before -Destination $Target -Force

Write-Host "UNDO OK"
Write-Host $Target