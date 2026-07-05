$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"

Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.repository.js" -Destination (Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.repository.js") -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.routes.js" -Destination (Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.routes.js") -Force
Copy-Item -LiteralPath "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-saved-list.html" -Destination (Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-saved-list.html") -Force

$Runtime = Join-Path $ProjectRoot "HD_ORIGIN_RUNTIME_PATHS.txt"
$NodePath = "node"

if (Test-Path -LiteralPath $Runtime) {
  $RuntimeLines = Get-Content -LiteralPath $Runtime -Encoding UTF8
  foreach ($Line in $RuntimeLines) {
    if ($Line -like "NODE_PATH=*") {
      $Candidate = $Line.Substring("NODE_PATH=".Length).Trim()
      if ($Candidate -and (Test-Path -LiteralPath $Candidate)) {
        $NodePath = $Candidate
      }
    }
  }
}

& $NodePath --check (Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.repository.js")
if ($LASTEXITCODE -ne 0) { throw "本体 receipts.repository.js 構文チェックNG" }

& $NodePath --check (Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.routes.js")
if ($LASTEXITCODE -ne 0) { throw "本体 receipts.routes.js 構文チェックNG" }

Write-Host "OK: レシート台帳ページと本保存済み閲覧APIを反映しました。"
Write-Host "URL: http://localhost:3000/receipts/receipt-saved-list.html"
