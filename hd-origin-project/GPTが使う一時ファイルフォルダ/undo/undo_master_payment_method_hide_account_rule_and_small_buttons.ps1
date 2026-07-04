$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$TempRoot = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ"
$Before = Join-Path $TempRoot "before\web_receiver\public\masters\master-management.html"
$Dst = Join-Path $ProjectRoot "web_receiver\public\masters\master-management.html"

if (-not (Test-Path $Before)) {
  throw "beforeファイルがありません: $Before"
}

Copy-Item $Before $Dst -Force
Write-Host "戻しました: web_receiver\public\masters\master-management.html"
