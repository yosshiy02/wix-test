$ErrorActionPreference = "Stop"
try { Set-PSReadLineOption -HistorySaveStyle SaveNothing } catch {}

$RuntimeFile = Join-Path "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\GPTに渡すフォルダ" "HD_ORIGIN_RUNTIME_PATHS.txt"
$ProjectRoot = ""

if (Test-Path -LiteralPath $RuntimeFile) {
  $runtime = @{}
  Get-Content -LiteralPath $RuntimeFile -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^\s*([^#=\s]+)\s*=(.*)$') {
      $runtime[$matches[1]] = $matches[2].Trim()
    }
  }

  $ProjectRoot = $runtime["PROJECT_ROOT"]
}

if (-not $ProjectRoot -or -not (Test-Path -LiteralPath $ProjectRoot)) {
  throw "PROJECT_ROOT が確認できないためUNDOできません。"
}

$TargetHtml = Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-specialist-invoice-payable.html"
$TargetCss  = Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-specialist-invoice-payable.css"

$HtmlBackup = Join-Path "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before" "REAL_payment-document-specialist-invoice-payable.before_apply_20260708_172159.html"
$CssBackup  = Join-Path "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\before" "REAL_payment-document-specialist-invoice-payable.before_apply_20260708_172159.css"

if (Test-Path -LiteralPath $HtmlBackup) {
  Copy-Item -LiteralPath $HtmlBackup -Destination $TargetHtml -Force
} else {
  if (Test-Path -LiteralPath $TargetHtml) {
    Remove-Item -LiteralPath $TargetHtml -Force
  }
}

if (Test-Path -LiteralPath $CssBackup) {
  Copy-Item -LiteralPath $CssBackup -Destination $TargetCss -Force
} else {
  if (Test-Path -LiteralPath $TargetCss) {
    Remove-Item -LiteralPath $TargetCss -Force
  }
}

Write-Host "OK: 請求・未払系専門解析ページを反映前へ戻しました。"
