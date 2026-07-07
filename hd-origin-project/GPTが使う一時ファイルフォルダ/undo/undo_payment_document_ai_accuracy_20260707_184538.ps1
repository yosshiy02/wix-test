$ErrorActionPreference = "Stop"

function Write-Utf8Memo($Path, $Lines) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, ($Lines -join "
"), $enc)
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path (Split-Path $ScriptDir -Parent) -Parent

$HtmlRel = "web_receiver\public\payables\payment-document-review.html"
$RoutesRel = "web_receiver\src\paymentDocuments\paymentDocuments.routes.js"

$HtmlBefore = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review_before_ai_accuracy_20260707_184538.html"
$RoutesBefore = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes_before_ai_accuracy_20260707_184538.js"

$HtmlDest = Join-Path $ProjectRoot $HtmlRel
$RoutesDest = Join-Path $ProjectRoot $RoutesRel

if (-not (Test-Path -LiteralPath $HtmlBefore)) { throw "before HTML が見つかりません: $HtmlBefore" }
if (-not (Test-Path -LiteralPath $RoutesBefore)) { throw "before routes が見つかりません: $RoutesBefore" }

Copy-Item -LiteralPath $HtmlBefore -Destination $HtmlDest -Force
Copy-Item -LiteralPath $RoutesBefore -Destination $RoutesDest -Force

$MemoDir = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\memo"
New-Item -ItemType Directory -Force -Path $MemoDir | Out-Null

$MemoPath = Join-Path $MemoDir "00_payment_document_ai_accuracy_undo_20260707_184538.txt"

$Out = @()
$Out += "=============================="
$Out += "支払書類内容確認 AI精度改善 UNDO結果"
$Out += "=============================="
$Out += "日時: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$Out += ""
$Out += "[PROJECT_ROOT]"
$Out += $ProjectRoot
$Out += ""
$Out += "[戻したファイル]"
$Out += "OK: $HtmlRel"
$Out += "OK: $RoutesRel"

Write-Utf8Memo $MemoPath $Out
notepad $MemoPath