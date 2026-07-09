cd "G:\GITHUB\wix-test\hd-origin-project"
$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$BeforeDir = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before"

$Files = @(
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\tax-public\rules.txt",
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\tax-public\fields.txt",
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\tax-public\examples.txt",
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\common\output-schema.txt"
)

foreach ($Rel in $Files) {
  $Backup = Join-Path $BeforeDir $Rel
  $Missing = $Backup + ".missing"
  $Dst = Join-Path $ProjectRoot $Rel

  if (Test-Path -LiteralPath $Missing) {
    if (Test-Path -LiteralPath $Dst) {
      Remove-Item -LiteralPath $Dst -Force
    }
    continue
  }

  if (-not (Test-Path -LiteralPath $Backup)) {
    throw "beforeファイルが見つかりません: $Backup"
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Dst) | Out-Null
  Copy-Item -LiteralPath $Backup -Destination $Dst -Force
}

Write-Host "OK: 税金・公的支払専門プロンプト育成をUNDOしました。"
