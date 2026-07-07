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

$ProjectRoot = Resolve-ProjectRoot
$BeforePath = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\public\payables\payment-document-review_before_fix_visible_memo_button_js_20260707_191612.html"
$HtmlPath = Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-review.html"

if (-not (Test-Path -LiteralPath $BeforePath)) {
  throw "before HTML が見つかりません: $BeforePath"
}

Copy-Item -LiteralPath $BeforePath -Destination $HtmlPath -Force

$MemoDir = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\memo"
New-Item -ItemType Directory -Force -Path $MemoDir | Out-Null
$MemoPath = Join-Path $MemoDir "00_payment_document_review_fix_visible_memo_button_js_undo_20260707_191612.txt"

$Out = @()
$Out += "=============================="
$Out += "支払書類内容確認 表示ボタンJS修正 UNDO結果"
$Out += "=============================="
$Out += "日時: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$Out += ""
$Out += "[戻したファイル]"
$Out += "OK: web_receiver\public\payables\payment-document-review.html"

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($MemoPath, ($Out -join "
"), $enc)
notepad $MemoPath