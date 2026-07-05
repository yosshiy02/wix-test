$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$Target = Join-Path $ProjectRoot "web_receiver\src\db.js"
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\db.js"

Copy-Item -LiteralPath $After -Destination $Target -Force

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

& $NodePath --check $Target
if ($LASTEXITCODE -ne 0) {
  throw "本体 db.js の構文チェックNG"
}

Write-Host "OK: db.js に PostgreSQL DATE 型を文字列で扱う設定を反映しました。"
Write-Host "DATE 型 OID 1082 は YYYY-MM-DD のまま返します。"
