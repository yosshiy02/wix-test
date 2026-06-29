$ErrorActionPreference = "Stop"

$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$EnvPath = Join-Path $ProjectRoot ".env"

$WixPendingUrl = "https://www.hatodaiya.com/_functions/receiptPending"
$WixMarkImportedUrl = "https://www.hatodaiya.com/_functions/receiptMarkImported"

function Read-DotEnv {
  param([string]$Path)

  $map = @{}

  if (-not (Test-Path $Path)) {
    throw ".env が見つかりません: $Path"
  }

  Get-Content $Path | ForEach-Object {
    $line = $_
    if ($line -match '^\s*$') { return }
    if ($line -match '^\s*#') { return }

    $parts = $line -split '=', 2
    if ($parts.Count -eq 2) {
      $map[$parts[0].Trim()] = $parts[1].Trim()
    }
  }

  return $map
}

function Get-JstNow {
  return [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "Tokyo Standard Time")
}

function Normalize-DateTimeText {
  param([object]$Value)

  if ($null -eq $Value) { return $null }
  $s = [string]$Value
  if ([string]::IsNullOrWhiteSpace($s)) { return $null }

  try {
    return ([DateTime]::Parse($s)).ToString("yyyy-MM-dd HH:mm:ss")
  } catch {
    return $null
  }
}

function Get-FirstValue {
  param(
    [object]$Obj,
    [string[]]$Names
  )

  if ($null -eq $Obj) { return $null }

  foreach ($name in $Names) {
    $prop = $Obj.PSObject.Properties[$name]
    if ($null -ne $prop -and $null -ne $prop.Value) {
      $v = $prop.Value

      if ($v -is [string]) {
        if (-not [string]::IsNullOrWhiteSpace($v)) {
          return $v
        }
      } else {
        return $v
      }
    }
  }

  return $null
}

function Get-ItemsFromResponse {
  param([object]$Response)

  if ($null -eq $Response) { return @() }

  if ($Response -is [array]) {
    return @($Response)
  }

  foreach ($name in @("items", "receipts", "data", "results")) {
    $prop = $Response.PSObject.Properties[$name]
    if ($null -ne $prop -and $null -ne $prop.Value) {
      return @($prop.Value)
    }
  }

  return @($Response)
}

function Convert-WixImageUrl {
  param([string]$Url)

  if ([string]::IsNullOrWhiteSpace($Url)) {
    return $null
  }

  if ($Url -match '^https?://') {
    return $Url
  }

  if ($Url -match '^wix:image://v1/([^/]+)') {
    return "https://static.wixstatic.com/media/$($Matches[1])"
  }

  return $Url
}

function Find-DropboxRoot {
  $candidates = @(
    "D:\DROPBOX\Dropbox",
    (Join-Path $env:USERPROFILE "Dropbox")
  )

  foreach ($p in $candidates) {
    if (Test-Path $p) {
      return $p
    }
  }

  throw "Dropboxフォルダが見つかりません。D:\DROPBOX\Dropbox または ユーザー配下Dropboxを確認してください。"
}

function SqlText {
  param([object]$Value)

  if ($null -eq $Value) { return "NULL" }

  $s = [string]$Value
  if ([string]::IsNullOrWhiteSpace($s)) { return "NULL" }

  $tag = "hd" + ([Guid]::NewGuid().ToString("N"))
  return ('$' + $tag + '$' + $s + '$' + $tag + '$')
}

function SqlNumber {
  param([object]$Value)

  if ($null -eq $Value) { return "NULL" }

  $s = [string]$Value
  if ([string]::IsNullOrWhiteSpace($s)) { return "NULL" }

  return $s
}

function SqlTimestamp {
  param([object]$Value)

  $s = Normalize-DateTimeText $Value
  if ([string]::IsNullOrWhiteSpace($s)) { return "NULL" }

  return "($((SqlText $s)))::timestamp"
}

function Invoke-PsqlFile {
  param(
    [hashtable]$EnvMap,
    [string]$Sql
  )

  $pgBin = $EnvMap["PG_BIN_PATH"]
  $dbHost = $EnvMap["DB_HOST"]
  $dbPort = $EnvMap["DB_PORT"]
  $dbName = $EnvMap["DB_NAME"]
  $dbUser = $EnvMap["DB_USER"]
  $dbPass = $EnvMap["DB_PASSWORD"]

  if ([string]::IsNullOrWhiteSpace($pgBin)) { throw "PG_BIN_PATH が .env にありません。" }
  if ([string]::IsNullOrWhiteSpace($dbName)) { throw "DB_NAME が .env にありません。" }
  if ([string]::IsNullOrWhiteSpace($dbUser)) { throw "DB_USER が .env にありません。" }

  $psql = Join-Path $pgBin "psql.exe"
  if (-not (Test-Path $psql)) {
    throw "psql.exe が見つかりません: $psql"
  }

  $tmp = Join-Path $env:TEMP ("hd_receipt_sql_" + [Guid]::NewGuid().ToString("N") + ".sql")
  Set-Content -Path $tmp -Value $Sql -Encoding UTF8

  try {
    $env:PGPASSWORD = $dbPass
    $env:PGCLIENTENCODING = "UTF8"

    & $psql `
      -v ON_ERROR_STOP=1 `
      -h $dbHost `
      -p $dbPort `
      -U $dbUser `
      -d $dbName `
      -f $tmp

    if ($LASTEXITCODE -ne 0) {
      throw "psql 実行に失敗しました。ExitCode=$LASTEXITCODE"
    }
  }
  finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\PGCLIENTENCODING -ErrorAction SilentlyContinue
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
}

function Ensure-ReceiptImportsTable {
  param([hashtable]$EnvMap)

  $sql = @(
    "CREATE SCHEMA IF NOT EXISTS accounting;",
    "",
    "CREATE TABLE IF NOT EXISTS accounting.receipt_imports (",
    "  id BIGSERIAL PRIMARY KEY,",
    "  upload_id TEXT,",
    "  wix_item_id TEXT,",
    "  wix_image_url TEXT,",
    "  local_image_file_name TEXT,",
    "  local_image_path TEXT,",
    "  image_hash_sha256 TEXT,",
    "  image_size_bytes BIGINT,",
    "  original_file_name TEXT,",
    "  captured_at_jst TIMESTAMP,",
    "  imported_at_jst TIMESTAMP,",
    "  import_batch_id TEXT,",
    "  ocr_provider TEXT,",
    "  ocr_raw_text TEXT,",
    "  ocr_line_count INTEGER,",
    "  ocr_word_count INTEGER,",
    "  status TEXT NOT NULL DEFAULT 'imported',",
    "  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,",
    "  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
    "",
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_receipt_imports_upload_id",
    "ON accounting.receipt_imports (upload_id)",
    "WHERE upload_id IS NOT NULL;",
    "",
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_receipt_imports_wix_item_id",
    "ON accounting.receipt_imports (wix_item_id)",
    "WHERE wix_item_id IS NOT NULL;",
    "",
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_receipt_imports_hash",
    "ON accounting.receipt_imports (image_hash_sha256)",
    "WHERE image_hash_sha256 IS NOT NULL;"
  ) -join [Environment]::NewLine

  Invoke-PsqlFile -EnvMap $EnvMap -Sql $sql
}

function Insert-ReceiptImport {
  param(
    [hashtable]$EnvMap,
    [hashtable]$Data
  )

  $sql = @(
    "INSERT INTO accounting.receipt_imports (",
    "  upload_id,",
    "  wix_item_id,",
    "  wix_image_url,",
    "  local_image_file_name,",
    "  local_image_path,",
    "  image_hash_sha256,",
    "  image_size_bytes,",
    "  original_file_name,",
    "  captured_at_jst,",
    "  imported_at_jst,",
    "  import_batch_id,",
    "  ocr_provider,",
    "  ocr_raw_text,",
    "  ocr_line_count,",
    "  ocr_word_count,",
    "  status",
    ") VALUES (",
    "  $(SqlText $Data.uploadId),",
    "  $(SqlText $Data.wixItemId),",
    "  $(SqlText $Data.wixImageUrl),",
    "  $(SqlText $Data.localImageFileName),",
    "  $(SqlText $Data.localImagePath),",
    "  $(SqlText $Data.imageHashSha256),",
    "  $(SqlNumber $Data.imageSizeBytes),",
    "  $(SqlText $Data.originalFileName),",
    "  $(SqlTimestamp $Data.capturedAtJst),",
    "  $(SqlTimestamp $Data.importedAtJst),",
    "  $(SqlText $Data.importBatchId),",
    "  $(SqlText $Data.ocrProvider),",
    "  $(SqlText $Data.ocrRawText),",
    "  $(SqlNumber $Data.ocrLineCount),",
    "  $(SqlNumber $Data.ocrWordCount),",
    "  $(SqlText $Data.status)",
    ")",
    "ON CONFLICT DO NOTHING;"
  ) -join [Environment]::NewLine

  Invoke-PsqlFile -EnvMap $EnvMap -Sql $sql
}

function Get-OcrRawText {
  param([object]$Obj)

  $raw = Get-FirstValue $Obj @("ocrRawText", "rawText", "ocrText")
  if ($null -ne $raw) { return [string]$raw }

  $ocr = Get-FirstValue $Obj @("ocr")
  if ($null -ne $ocr) {
    $raw2 = Get-FirstValue $ocr @("rawText", "text", "content")
    if ($null -ne $raw2) { return [string]$raw2 }
  }

  return ""
}

function Get-ImageValue {
  param([object]$Obj)

  $v = Get-FirstValue $Obj @(
    "wixImageUrl",
    "imageUrl",
    "receiptImage",
    "image",
    "fileUrl",
    "mediaUrl"
  )

  if ($null -eq $v) { return $null }

  if ($v -is [string]) {
    return $v
  }

  $nested = Get-FirstValue $v @("src", "url", "fileUrl")
  if ($null -ne $nested) {
    return [string]$nested
  }

  return [string]$v
}

function Get-UniqueFilePath {
  param(
    [string]$Dir,
    [string]$FileName
  )

  $path = Join-Path $Dir $FileName
  if (-not (Test-Path $path)) {
    return $path
  }

  $name = [IO.Path]::GetFileNameWithoutExtension($FileName)
  $ext = [IO.Path]::GetExtension($FileName)

  for ($i = 2; $i -lt 1000; $i++) {
    $candidate = Join-Path $Dir ("{0}_{1}{2}" -f $name, $i, $ext)
    if (-not (Test-Path $candidate)) {
      return $candidate
    }
  }

  throw "保存ファイル名の重複回避に失敗しました。"
}

$envMap = Read-DotEnv -Path $EnvPath

$key = $env:HD_ORIGIN_RECEIPT_API_KEY

if ([string]::IsNullOrWhiteSpace($key)) {
  $key = Read-Host "HD_ORIGIN_RECEIPT_API_KEY を入力"
}

if ([string]::IsNullOrWhiteSpace($key)) {
  throw "APIキーが空です。"
}

$dropboxRoot = Find-DropboxRoot
$jstNow = Get-JstNow
$importBatchId = "B" + $jstNow.ToString("yyyyMMdd-HHmmss")

$imageRoot = Join-Path $dropboxRoot "会社\レシート\画像"
$logRoot = Join-Path $dropboxRoot "会社\レシート\取込ログ"

New-Item -ItemType Directory -Path $imageRoot -Force | Out-Null
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

Write-Host "DBテーブル確認中..."
Ensure-ReceiptImportsTable -EnvMap $envMap

Write-Host "Wixから未取込レシートを取得中..."

$response = Invoke-RestMethod `
  -Method GET `
  -Uri $WixPendingUrl `
  -Headers @{ "x-hd-origin-key" = $key }

$items = Get-ItemsFromResponse $response

if ($items.Count -eq 0) {
  Write-Host "未取込レシートはありません。"
  exit 0
}

Write-Host ("未取込件数: {0}" -f $items.Count)

$logPath = Join-Path $logRoot ($importBatchId + ".jsonl")

foreach ($item in $items) {
  $src = $item
  $dataProp = $item.PSObject.Properties["data"]
  if ($null -ne $dataProp -and $null -ne $dataProp.Value) {
    $src = $dataProp.Value
  }

  $wixItemId = Get-FirstValue $item @("_id", "id", "wixItemId")
  if ($null -eq $wixItemId) {
    $wixItemId = Get-FirstValue $src @("_id", "id", "wixItemId")
  }

  $uploadId = Get-FirstValue $src @("uploadId")
  if ($null -eq $uploadId) {
    $uploadId = $wixItemId
  }

  $rawImageValue = Get-ImageValue $src
  $imageUrl = Convert-WixImageUrl $rawImageValue

  if ([string]::IsNullOrWhiteSpace($imageUrl)) {
    throw "画像URLが取得できません。wixItemId=$wixItemId"
  }

  $capturedAtJst = Get-FirstValue $src @("capturedAtJst", "capturedAt", "createdAtJst", "_createdDate")
  $baseTime = $jstNow

  $normalizedCaptured = Normalize-DateTimeText $capturedAtJst
  if (-not [string]::IsNullOrWhiteSpace($normalizedCaptured)) {
    try {
      $baseTime = [DateTime]::Parse($normalizedCaptured)
    } catch {}
  }

  $yyyy = $baseTime.ToString("yyyy")
  $mm = $baseTime.ToString("MM")
  $saveDir = Join-Path $imageRoot (Join-Path $yyyy $mm)
  New-Item -ItemType Directory -Path $saveDir -Force | Out-Null

  $fileName = "R{0}_receipt.jpg" -f $baseTime.ToString("yyyyMMdd-HHmmss")
  $localPath = Get-UniqueFilePath -Dir $saveDir -FileName $fileName
  $localFileName = [IO.Path]::GetFileName($localPath)

  Write-Host ("画像保存中: {0}" -f $localFileName)

  Invoke-WebRequest `
    -Uri $imageUrl `
    -OutFile $localPath `
    -UseBasicParsing

  $hash = (Get-FileHash -Path $localPath -Algorithm SHA256).Hash
  $sizeBytes = (Get-Item $localPath).Length

  $ocrRawText = Get-OcrRawText $src
  $ocrProvider = Get-FirstValue $src @("ocrProvider")
  if ([string]::IsNullOrWhiteSpace([string]$ocrProvider)) {
    $ocrProvider = "Azure Document Intelligence Read"
  }

  $lines = @()
  if (-not [string]::IsNullOrWhiteSpace($ocrRawText)) {
    $lines = $ocrRawText -split "\r?\n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  }

  $words = @()
  if (-not [string]::IsNullOrWhiteSpace($ocrRawText)) {
    $words = $ocrRawText -split "\s+" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  }

  $importedAtJst = (Get-JstNow).ToString("yyyy-MM-dd HH:mm:ss")

  $originalFileName = Get-FirstValue $src @("originalFileName", "fileName", "name")

  $dbData = @{
    uploadId = [string]$uploadId
    wixItemId = [string]$wixItemId
    wixImageUrl = [string]$rawImageValue
    localImageFileName = [string]$localFileName
    localImagePath = [string]$localPath
    imageHashSha256 = [string]$hash
    imageSizeBytes = [int64]$sizeBytes
    originalFileName = [string]$originalFileName
    capturedAtJst = $capturedAtJst
    importedAtJst = $importedAtJst
    importBatchId = $importBatchId
    ocrProvider = [string]$ocrProvider
    ocrRawText = [string]$ocrRawText
    ocrLineCount = [int]$lines.Count
    ocrWordCount = [int]$words.Count
    status = "imported"
  }

  Write-Host "PostgreSQLへ保存中..."
  Insert-ReceiptImport -EnvMap $envMap -Data $dbData

  $logObj = [ordered]@{
    uploadId = $dbData.uploadId
    wixItemId = $dbData.wixItemId
    wixImageUrl = $dbData.wixImageUrl
    localImageFileName = $dbData.localImageFileName
    localImagePath = $dbData.localImagePath
    imageHashSha256 = $dbData.imageHashSha256
    imageSizeBytes = $dbData.imageSizeBytes
    originalFileName = $dbData.originalFileName
    capturedAtJst = $dbData.capturedAtJst
    importedAtJst = $dbData.importedAtJst
    importBatchId = $dbData.importBatchId
    ocrProvider = $dbData.ocrProvider
    ocrLineCount = $dbData.ocrLineCount
    ocrWordCount = $dbData.ocrWordCount
    status = $dbData.status
  }

  ($logObj | ConvertTo-Json -Depth 10 -Compress) | Add-Content -Path $logPath -Encoding UTF8

  Write-Host "Wixを imported に更新中..."

  $markPayloadItem = @{
    _id = [string]$wixItemId
    id = [string]$wixItemId
    wixItemId = [string]$wixItemId
    uploadId = [string]$uploadId
    importBatchId = $importBatchId
    importedAtJst = $importedAtJst
    localImageFileName = [string]$localFileName
    localImagePath = [string]$localPath
    imageHashSha256 = [string]$hash
  }

  $markBody = @{
    ids = @([string]$wixItemId)
    items = @($markPayloadItem)
  } | ConvertTo-Json -Depth 10

  Invoke-RestMethod `
    -Method POST `
    -Uri $WixMarkImportedUrl `
    -Headers @{ "x-hd-origin-key" = $key } `
    -ContentType "application/json; charset=utf-8" `
    -Body $markBody | Out-Null

  Write-Host ("完了: {0}" -f $localFileName)
}

Write-Host "全件完了しました。"
Write-Host ("取込ログ: {0}" -f $logPath)

