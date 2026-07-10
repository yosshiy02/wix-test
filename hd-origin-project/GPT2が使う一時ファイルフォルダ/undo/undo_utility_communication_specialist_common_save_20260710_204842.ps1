$ErrorActionPreference = "Stop"

$Current = (Get-Location).Path
$Dir = Get-Item -LiteralPath $Current
$ProjectRoot = $null

while ($null -ne $Dir) {
  if (
    (Test-Path -LiteralPath (Join-Path $Dir.FullName "web_receiver")) -and
    (Test-Path -LiteralPath (Join-Path $Dir.FullName "database"))
  ) {
    $ProjectRoot = $Dir.FullName
    break
  }
  $Dir = $Dir.Parent
}

if (-not $ProjectRoot) {
  throw "PROJECT_ROOT not found"
}

$TempRoot = Get-ChildItem -LiteralPath $ProjectRoot -Directory |
  Where-Object { $_.Name -like "GPT2*" } |
  Select-Object -First 1

if (-not $TempRoot) {
  throw "GPT2 temp root not found"
}

$BeforeDir = Join-Path $TempRoot.FullName "before"
$HtmlPath = Join-Path $ProjectRoot "web_receiver\public\payables\payment-document-specialist-utility-communication.html"
$BeforeHtml = Join-Path $BeforeDir "payment-document-specialist-utility-communication.before_specialist_common_save_20260710_204842.html"

Copy-Item -LiteralPath $BeforeHtml -Destination $HtmlPath -Force
Write-Host "OK"