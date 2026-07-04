$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$TempRoot = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ"
$AfterRoot = Join-Path $TempRoot "after"

$Targets = @(
  "web_receiver\public\masters\master-management.html",
  "web_receiver\src\masters\master.repository.js"
)

foreach ($Rel in $Targets) {
  $Src = Join-Path $AfterRoot $Rel
  $Dst = Join-Path $ProjectRoot $Rel

  if (-not (Test-Path $Src)) {
    throw "afterファイルがありません: $Src"
  }

  Copy-Item $Src $Dst -Force
  Write-Host "反映しました: $Rel"
}

Write-Host "完了: マスタ管理 実務向け修正を本体へ反映しました。"
