cd "G:\GITHUB\wix-test\hd-origin-project"
$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$BeforeDir = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before"

$Files = @(
  "web_receiver\src\paymentDocuments\paymentDocuments.routes.js",
  "web_receiver\public\payables\payment-document-specialist-tax-public.html",
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\common\system.txt",
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\common\output-schema.txt",
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\common\human-confirm-rules.txt",
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\tax-public\system.txt",
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\tax-public\fields.txt",
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\tax-public\rules.txt",
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\tax-public\examples.txt"
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

Write-Host "OK: 税金・公的支払AI修正をUNDOしました。"
