$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$TempRoot = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ"
$After = Join-Path $TempRoot "after\web_receiver\src\projectStatus.js"
$Dst = Join-Path $ProjectRoot "web_receiver\src\projectStatus.js"

if (-not (Test-Path $After)) {
  throw "afterファイルがありません: $After"
}

Copy-Item $After $Dst -Force
Write-Host "反映しました: web_receiver\src\projectStatus.js"
