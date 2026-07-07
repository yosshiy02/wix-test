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

$HtmlAfter = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\public\payables\payment-document-review_after_ai_accuracy_20260707_184538.html"
$RoutesAfter = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\src\paymentDocuments\paymentDocuments.routes_after_ai_accuracy_20260707_184538.js"

$HtmlDest = Join-Path $ProjectRoot $HtmlRel
$RoutesDest = Join-Path $ProjectRoot $RoutesRel

if (-not (Test-Path -LiteralPath $HtmlAfter)) { throw "after HTML が見つかりません: $HtmlAfter" }
if (-not (Test-Path -LiteralPath $RoutesAfter)) { throw "after routes が見つかりません: $RoutesAfter" }

Copy-Item -LiteralPath $HtmlAfter -Destination $HtmlDest -Force
Copy-Item -LiteralPath $RoutesAfter -Destination $RoutesDest -Force

$MemoDir = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\memo"
New-Item -ItemType Directory -Force -Path $MemoDir | Out-Null

$MemoPath = Join-Path $MemoDir "00_payment_document_ai_accuracy_apply_20260707_184538.txt"

$Out = @()
$Out += "=============================="
$Out += "支払書類内容確認 AI精度改善 反映結果"
$Out += "=============================="
$Out += "日時: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$Out += ""
$Out += "[PROJECT_ROOT]"
$Out += $ProjectRoot
$Out += ""
$Out += "[反映]"
$Out += "OK: $HtmlRel"
$Out += "OK: $RoutesRel"
$Out += ""
$Out += "[内容]"
$Out += "- AI反映先IDを画面実IDへ合わせた"
$Out += "- 支払書類AIプロンプトへ業務判断ルールを追加"
$Out += "- OpenAI呼び出し temperature を 0 に変更"
$Out += ""
$Out += "[UNDO]"
$Out += "戻す場合:"
$Out += "powershell -ExecutionPolicy Bypass -File "$(Join-Path $ProjectRoot 'GPTが使う一時ファイルフォルダ\undo\undo_payment_document_ai_accuracy_20260707_184538.ps1')""

Write-Utf8Memo $MemoPath $Out
notepad $MemoPath