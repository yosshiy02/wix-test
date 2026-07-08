$ErrorActionPreference = "Stop"
try { Set-PSReadLineOption -HistorySaveStyle SaveNothing } catch {}

$ProjectRoot = (Split-Path -Path (Split-Path -Path "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ" -Parent) -Parent)

$RuntimeFile = Join-Path "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\GPTに渡すフォルダ" "HD_ORIGIN_RUNTIME_PATHS.txt"

if (Test-Path -LiteralPath $RuntimeFile) {
  $runtime = @{}
  Get-Content -LiteralPath $RuntimeFile -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^\s*([^#=\s]+)\s*=(.*)$') {
      $runtime[$matches[1]] = $matches[2].Trim()
    }
  }

  if ($runtime["PROJECT_ROOT"] -and (Test-Path -LiteralPath $runtime["PROJECT_ROOT"])) {
    $ProjectRoot = $runtime["PROJECT_ROOT"]
  }
}

$TargetHtml = Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-specialist-invoice-payable.html"
$TargetCss  = Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-specialist-invoice-payable.css"

$BackupDir = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before"
$TargetHtmlBackup = Join-Path $BackupDir "REAL_payment-document-specialist-invoice-payable.before_apply_20260708_172159.html"
$TargetCssBackup  = Join-Path $BackupDir "REAL_payment-document-specialist-invoice-payable.before_apply_20260708_172159.css"

if (Test-Path -LiteralPath $TargetHtml) {
  Copy-Item -LiteralPath $TargetHtml -Destination $TargetHtmlBackup -Force
}

if (Test-Path -LiteralPath $TargetCss) {
  Copy-Item -LiteralPath $TargetCss -Destination $TargetCssBackup -Force
}

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\after\web_receiver\public\payables\payment-document-specialist-invoice-payable.html" -Destination $TargetHtml -Force
Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\after\web_receiver\public\payables\payment-document-specialist-invoice-payable.css" -Destination $TargetCss -Force

Write-Host "OK: 請求・未払系専門解析ページを本体へ反映しました。"
Write-Host "HTML: $TargetHtml"
Write-Host "CSS : $TargetCss"
