$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$TempRoot = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ"
$After = Join-Path $TempRoot "after\web_receiver\public\masters\master-management.html"
$Dst = Join-Path $ProjectRoot "web_receiver\public\masters\master-management.html"

if (-not (Test-Path $After)) {
  throw "afterファイルがありません: $After"
}

Copy-Item $After $Dst -Force
Write-Host "反映しました: web_receiver\public\masters\master-management.html"
