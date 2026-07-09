cd "G:\GITHUB\wix-test\hd-origin-project"
$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\payables\payment-document-specialist-tax-public.html"
$Dst = Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-specialist-tax-public.html"

Copy-Item -LiteralPath $After -Destination $Dst -Force

$CheckHtml = Get-Content -LiteralPath $Dst -Raw -Encoding UTF8
foreach ($Needle in @(
  "ai-sort|ai-specialist",
  "GPT00_TAX_PUBLIC_SINGLE_SAVE_AI_RAW_DRAFT_20260709_START",
  "GPT00_TAX_PUBLIC_BULK_SAVE_ANALYSIS_SYSTEM_20260709_START"
)) {
  if (-not $CheckHtml.Contains($Needle)) {
    throw "本体反映確認失敗: $Needle がありません。"
  }
}

Write-Host "OK: 税金・公的支払専門AI結果をそのまま下書き保存へ渡す修正を反映しました。GPT2側は未使用。"
