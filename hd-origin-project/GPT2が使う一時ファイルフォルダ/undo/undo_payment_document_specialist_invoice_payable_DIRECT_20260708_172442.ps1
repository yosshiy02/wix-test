$ErrorActionPreference = "Stop"
try { Set-PSReadLineOption -HistorySaveStyle SaveNothing } catch {}

$TargetHtml = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-invoice-payable.html"
$TargetCss  = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\public\payables\payment-document-specialist-invoice-payable.css"
$BackupHtml = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\REAL_payment-document-specialist-invoice-payable.before_direct_apply_20260708_172442.html"
$BackupCss  = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before\REAL_payment-document-specialist-invoice-payable.before_direct_apply_20260708_172442.css"

if (Test-Path -LiteralPath $BackupHtml) {
  Copy-Item -LiteralPath $BackupHtml -Destination $TargetHtml -Force
} else {
  if (Test-Path -LiteralPath $TargetHtml) {
    Remove-Item -LiteralPath $TargetHtml -Force
  }
}

if (Test-Path -LiteralPath $BackupCss) {
  Copy-Item -LiteralPath $BackupCss -Destination $TargetCss -Force
} else {
  if (Test-Path -LiteralPath $TargetCss) {
    Remove-Item -LiteralPath $TargetCss -Force
  }
}

Write-Host "OK: 請求・未払系専門解析ページを直接反映前へ戻しました。"
