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
$BeforePath = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\projectStatus_before_payment_sorting_handoff_20260707_201940.js"
$ProjectStatusPath = Join-Path $ProjectRoot "web_receiver\src\projectStatus.js"

if (-not (Test-Path -LiteralPath $BeforePath)) {
  throw "before projectStatus.js が見つかりません: $BeforePath"
}

Copy-Item -LiteralPath $BeforePath -Destination $ProjectStatusPath -Force

$MemoDir = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\memo"
New-Item -ItemType Directory -Force -Path $MemoDir | Out-Null

$MemoPath = Join-Path $MemoDir "00_project_status_payment_sorting_handoff_undo_20260707_201940.txt"

$Out = @()
$Out += "=============================="
$Out += "スタート文書作成プログラム 支払書類仕分け引き継ぎ UNDO結果"
$Out += "=============================="
$Out += "日時: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$Out += ""
$Out += "[戻したファイル]"
$Out += "OK: web_receiver\src\projectStatus.js"

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($MemoPath, ($Out -join "
"), $enc)
notepad $MemoPath