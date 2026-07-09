cd "G:\GITHUB\wix-test\hd-origin-project"
$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$AfterDir = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after"

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
  $Src = Join-Path $AfterDir $Rel
  $Dst = Join-Path $ProjectRoot $Rel

  if (-not (Test-Path -LiteralPath $Src)) {
    throw "afterファイルが見つかりません: $Src"
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Dst) | Out-Null
  Copy-Item -LiteralPath $Src -Destination $Dst -Force
}

$NodePath = "G:\Apps\NodeJS\node.exe"
$Routes = Join-Path $ProjectRoot "web_receiver\src\paymentDocuments\paymentDocuments.routes.js"
$Check = & $NodePath --check $Routes 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "本体反映後 routes.js の構文確認に失敗しました。
$Check"
}

Write-Host "OK: 税金・公的支払AIをAI判定項目方式へ反映しました。GPT2側は未使用。"
