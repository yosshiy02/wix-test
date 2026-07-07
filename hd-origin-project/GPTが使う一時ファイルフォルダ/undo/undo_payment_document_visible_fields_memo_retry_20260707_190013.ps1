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

$HtmlBefore = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review_before_visible_fields_memo_retry_20260707_190013.html"
$CssBefore = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review_before_visible_fields_memo_retry_20260707_190013.css"
$RoutesBefore = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes_before_visible_fields_memo_retry_20260707_190013.js"

$HtmlDest = Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-review.html"
$CssDest = Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-review.css"
$RoutesDest = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\paymentDocuments.routes.js"

if (-not (Test-Path -LiteralPath $HtmlBefore)) { throw "before HTML が見つかりません: $HtmlBefore" }
if (-not (Test-Path -LiteralPath $CssBefore)) { throw "before CSS が見つかりません: $CssBefore" }
if (-not (Test-Path -LiteralPath $RoutesBefore)) { throw "before routes が見つかりません: $RoutesBefore" }

Copy-Item -LiteralPath $HtmlBefore -Destination $HtmlDest -Force
Copy-Item -LiteralPath $CssBefore -Destination $CssDest -Force
Copy-Item -LiteralPath $RoutesBefore -Destination $RoutesDest -Force

$MemoDir = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\memo"
New-Item -ItemType Directory -Force -Path $MemoDir | Out-Null

$MemoPath = Join-Path $MemoDir "00_payment_document_visible_fields_memo_retry_undo_20260707_190013.txt"

$Out = @()
$Out += "=============================="
$Out += "支払書類内容確認 表示項目memoボタン UNDO結果"
$Out += "=============================="
$Out += "日時: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$Out += ""
$Out += "[戻したファイル]"
$Out += "OK: web_receiver\public\payables\payment-document-review.html"
$Out += "OK: web_receiver\public\payables\payment-document-review.css"
$Out += "OK: web_receiver\src\paymentDocuments\paymentDocuments.routes.js"

Write-Utf8NoBom $MemoPath ($Out -join "
")
notepad $MemoPath