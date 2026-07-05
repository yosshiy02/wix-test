$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"

$AfterHtml = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\public\receipts\receipt-list.html"
$AfterRepo = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.repository.js"
$AfterRoutes = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.routes.js"
$AfterMigration = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\after\database\migrations\20260705_002_receipt_is_settled.sql"

$HtmlTarget = Join-Path $ProjectRoot "web_receiver\public\receipts\receipt-list.html"
$RepoTarget = Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.repository.js"
$RoutesTarget = Join-Path $ProjectRoot "web_receiver\src\receipts\receipts.routes.js"
$MigrationTarget = Join-Path $ProjectRoot "database\migrations\20260705_002_receipt_is_settled.sql"

Copy-Item -LiteralPath $AfterHtml -Destination $HtmlTarget -Force
Copy-Item -LiteralPath $AfterRepo -Destination $RepoTarget -Force
Copy-Item -LiteralPath $AfterRoutes -Destination $RoutesTarget -Force
Copy-Item -LiteralPath $AfterMigration -Destination $MigrationTarget -Force

$NodePath = "G:\Apps\NodeJS\node.exe"
if (!(Test-Path $NodePath)) { $NodePath = "node" }

$RepoCheck = & $NodePath --check $RepoTarget 2>&1
$RepoOk = $LASTEXITCODE -eq 0

$RoutesCheck = & $NodePath --check $RoutesTarget 2>&1
$RoutesOk = $LASTEXITCODE -eq 0

Write-Host "repository node --check OK:" $RepoOk
if (!$RepoOk) { Write-Host $RepoCheck }

Write-Host "routes node --check OK:" $RoutesOk
if (!$RoutesOk) { Write-Host $RoutesCheck }

if (!$RepoOk -or !$RoutesOk) {
  throw "JS構文チェックNGです。UNDOしてください。"
}

$RuntimeFile = Join-Path $ProjectRoot "HD_ORIGIN_RUNTIME_PATHS.txt"
$Runtime = @{}
if (Test-Path $RuntimeFile) {
  Get-Content -LiteralPath $RuntimeFile -Encoding UTF8 | ForEach-Object {
    if ($_ -match "^([^=]+)=(.*)$") {
      $Runtime[$matches[1]] = $matches[2]
    }
  }
}

$PgBin = $Runtime["PG_BIN_PATH"]
if (!$PgBin) { $PgBin = "G:\Apps\PostgreSQL\17\bin" }

$Psql = Join-Path $PgBin "psql.exe"
if (!(Test-Path $Psql)) {
  $Psql = "psql"
}

$DbName = $Runtime["DB_NAME"]
if (!$DbName) { $DbName = "hd_origin_project" }

$DbUser = $Runtime["DB_USER"]
if (!$DbUser) { $DbUser = "postgres" }

Write-Host ""
Write-Host "DB migration 実行:"
Write-Host $MigrationTarget

& $Psql -U $DbUser -d $DbName -f $MigrationTarget

if ($LASTEXITCODE -ne 0) {
  throw "DB migration 実行に失敗しました。psqlの表示を確認してください。"
}

Write-Host ""
Write-Host "確認SQL:"
& $Psql -U $DbUser -d $DbName -c "SELECT table_schema, table_name, column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='accounting' AND table_name IN ('receipt_draft_details','receipt_details') AND column_name='is_settled' ORDER BY table_name;"

Write-Host ""
Write-Host "適用完了: is_settled DB保存対応"
