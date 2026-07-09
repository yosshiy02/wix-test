cd "G:\GITHUB\wix-test\hd-origin-project"
$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$AfterDir = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after"

$Files = @(
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\tax-public\rules.txt",
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\tax-public\fields.txt",
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\tax-public\examples.txt",
  "web_receiver\src\paymentDocuments\prompts\stage3-specialist\common\output-schema.txt"
)

foreach ($Rel in $Files) {
  $Src = Join-Path $AfterDir $Rel
  $Dst = Join-Path $ProjectRoot $Rel

  if (-not (Test-Path -LiteralPath $Src)) {
    throw "afterファイルが見つかりません: $Src"
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Dst) | Out-Null
  Copy-Item -LiteralPath $Src -Destination $Dst -Force
}

Write-Host "OK: 税金・公的支払専門プロンプトを育成しました。GPT2側は未使用。"
