$ErrorActionPreference = "Stop"

function Resolve-ProjectRoot {
  $dir = (Get-Location).Path

  while ($dir) {
    if (Test-Path (Join-Path $dir "web_receiver\server.js")) {
      return $dir
    }

    $parent = Split-Path $dir -Parent
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $dir) {
      break
    }

    $dir = $parent
  }

  throw "PROJECT_ROOT が見つかりません。"
}

function Write-Utf8NoBom($Path, $Text) {
  $parent = Split-Path $Path -Parent
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

$ProjectRoot = Resolve-ProjectRoot

$RoutesBefore = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes_before_ai_prompt_split_20260707_193658.js"
$RoutesDest = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\paymentDocuments.routes.js"

if (-not (Test-Path -LiteralPath $RoutesBefore)) {
  throw "before routes が見つかりません: $RoutesBefore"
}

Copy-Item -LiteralPath $RoutesBefore -Destination $RoutesDest -Force

$LoaderBefore = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.aiPromptLoader_before_ai_prompt_split_20260707_193658.js"
$LoaderDest = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\paymentDocuments.aiPromptLoader.js"
if (Test-Path -LiteralPath $LoaderBefore) {
  Copy-Item -LiteralPath $LoaderBefore -Destination $LoaderDest -Force
}

$BeforePrompt = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\prompts\classification.system.txt"
$DestPrompt = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\classification.system.txt"
if (Test-Path -LiteralPath $BeforePrompt) {
  Copy-Item -LiteralPath $BeforePrompt -Destination $DestPrompt -Force
}
$BeforePrompt = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\prompts\detail.system.txt"
$DestPrompt = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\detail.system.txt"
if (Test-Path -LiteralPath $BeforePrompt) {
  Copy-Item -LiteralPath $BeforePrompt -Destination $DestPrompt -Force
}
$DestPrompt = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\common-rules.txt"
if (Test-Path -LiteralPath $DestPrompt) {
  Remove-Item -LiteralPath $DestPrompt -Force
}
$DestPrompt = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\rules-invoice.txt"
if (Test-Path -LiteralPath $DestPrompt) {
  Remove-Item -LiteralPath $DestPrompt -Force
}
$DestPrompt = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\rules-insurance.txt"
if (Test-Path -LiteralPath $DestPrompt) {
  Remove-Item -LiteralPath $DestPrompt -Force
}
$DestPrompt = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\rules-tax.txt"
if (Test-Path -LiteralPath $DestPrompt) {
  Remove-Item -LiteralPath $DestPrompt -Force
}
$DestPrompt = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\rules-mail-saved.txt"
if (Test-Path -LiteralPath $DestPrompt) {
  Remove-Item -LiteralPath $DestPrompt -Force
}
$DestPrompt = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\rules-card.txt"
if (Test-Path -LiteralPath $DestPrompt) {
  Remove-Item -LiteralPath $DestPrompt -Force
}
$DestPrompt = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\rules-utility.txt"
if (Test-Path -LiteralPath $DestPrompt) {
  Remove-Item -LiteralPath $DestPrompt -Force
}
$DestPrompt = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\rules-lease.txt"
if (Test-Path -LiteralPath $DestPrompt) {
  Remove-Item -LiteralPath $DestPrompt -Force
}
$DestPrompt = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\prompts\rules-receipt.txt"
if (Test-Path -LiteralPath $DestPrompt) {
  Remove-Item -LiteralPath $DestPrompt -Force
}

$MemoDir = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\memo"
New-Item -ItemType Directory -Force -Path $MemoDir | Out-Null

$MemoPath = Join-Path $MemoDir "00_payment_document_ai_prompt_split_undo_20260707_193658.txt"

$Out = @()
$Out += "=============================="
$Out += "支払書類AI 書類別プロンプト分割 UNDO結果"
$Out += "=============================="
$Out += "日時: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$Out += ""
$Out += "[戻したファイル]"
$Out += "OK: web_receiver\src\paymentDocuments\paymentDocuments.routes.js"
$Out += "OK: web_receiver\src\paymentDocuments\paymentDocuments.aiPromptLoader.js / prompts は作成前状態へ戻し"

Write-Utf8NoBom $MemoPath ($Out -join "
")
notepad $MemoPath