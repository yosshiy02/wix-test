$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$TempRoot = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ"
$BeforeRoot = Join-Path $TempRoot "before"

$Targets = @(
  "web_receiver\public\masters\master-management.html",
  "web_receiver\src\masters\master.repository.js"
)

foreach ($Rel in $Targets) {
  $Src = Join-Path $BeforeRoot $Rel
  $Dst = Join-Path $ProjectRoot $Rel

  if (-not (Test-Path $Src)) {
    throw "beforeファイルがありません: $Src"
  }

  Copy-Item $Src $Dst -Force
  Write-Host "戻しました: $Rel"
}

Write-Host "完了: マスタ管理 実務向け修正を修正前へ戻しました。"
