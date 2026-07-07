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

$RoutesBefore = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\paymentDocuments\paymentDocuments.routes_before_invoice_final_cleanup_20260707_195023.js"
$RoutesPath = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\paymentDocuments.routes.js"

if (-not (Test-Path -LiteralPath $RoutesBefore)) {
  throw "before routes が見つかりません: $RoutesBefore"
}

Copy-Item -LiteralPath $RoutesBefore -Destination $RoutesPath -Force

$MemoDir = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\memo"
New-Item -ItemType Directory -Force -Path $MemoDir | Out-Null

$MemoPath = Join-Path $MemoDir "00_payment_document_invoice_final_cleanup_undo_20260707_195023.txt"

$Out = @()
$Out += "=============================="
$Out += "支払書類AI 請求書最終掃除 UNDO結果"
$Out += "=============================="
$Out += "日時: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$Out += ""
$Out += "[戻したファイル]"
$Out += "OK: web_receiver\src\paymentDocuments\paymentDocuments.routes.js"

Write-Utf8NoBom $MemoPath ($Out -join "
")
notepad $MemoPath