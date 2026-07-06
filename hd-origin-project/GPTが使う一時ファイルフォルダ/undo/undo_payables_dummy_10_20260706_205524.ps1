$ErrorActionPreference = "Stop"
# ==============================
# 請求書・未払管理 ダミーデータ10件 削除UNDO
# batch: HD_ORIGIN_PAYABLE_DUMMY_BATCH_20260706_205524
# ==============================
function Test-HdProjectRoot {
  param([string]$Path)
  if (-not $Path) { return $false }
  return (
    (Test-Path -LiteralPath (Join-Path $Path "web_receiver\server.js")) -and
    (Test-Path -LiteralPath (Join-Path $Path "web_receiver\src\db.js")) -and
    (Test-Path -LiteralPath (Join-Path $Path "HD_ORIGIN_RUNTIME_PATHS.txt"))
  )
}
function Find-HdProjectRoot {
  $Candidates = New-Object System.Collections.Generic.List[string]
  foreach ($Root in @((Get-Location).Path, (Join-Path $env:USERPROFILE "Desktop"), (Join-Path $env:USERPROFILE "OneDrive\Desktop"))) {
    if (-not (Test-Path -LiteralPath $Root)) { continue }
    Get-ChildItem -LiteralPath $Root -Directory -Filter "hd-origin-project" -Recurse -ErrorAction SilentlyContinue |
      ForEach-Object {
        if (Test-HdProjectRoot $_.FullName) {
          if (-not $Candidates.Contains($_.FullName)) {
            $Candidates.Add($_.FullName) | Out-Null
          }
        }
      }
  }
  if ($Candidates.Count -eq 0) {
    throw "PROJECT_ROOT を見つけられませんでした。"
  }
  return ($Candidates | Sort-Object { (Get-Item $_).LastWriteTime } -Descending | Select-Object -First 1)
}
$ProjectRoot = Find-HdProjectRoot
$TempRoot = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ"
$Runner = Join-Path $TempRoot "_undo_payables_dummy_10_20260706_205524.js"
$RunnerJs = @'
const path = require("path");
const projectRoot = process.argv[2];
const batchTag = process.argv[3];
process.chdir(path.join(projectRoot, "web_receiver"));
require(path.join(projectRoot, "web_receiver", "src", "config"));
const db = require(path.join(projectRoot, "web_receiver", "src", "db"));
const { createBackup } = require(path.join(projectRoot, "web_receiver", "src", "backups", "backup.service"));
async function query(sql, params) {
  if (db && typeof db.query === "function") return db.query(sql, params);
  if (db && db.pool && typeof db.pool.query === "function") return db.pool.query(sql, params);
  throw new Error("db.query が見つかりません。");
}
async function closeDb() {
  if (db && db.pool && typeof db.pool.end === "function") {
    await db.pool.end();
    return;
  }
  if (db && typeof db.end === "function") {
    await db.end();
  }
}
async function main() {
  const backup = await createBackup("before_payables_dummy_delete_" + new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14));
  const before = await query(
    SELECT COUNT(*)::INTEGER AS count
    FROM accounting.payable_documents
    WHERE source_memo = 
  , [batchTag]);
  const deleted = await query(
    DELETE FROM accounting.payable_documents
    WHERE source_memo = 
    RETURNING payable_id, payable_no, vendor_name
  , [batchTag]);
  const after = await query(
    SELECT COUNT(*)::INTEGER AS count
    FROM accounting.payable_documents
    WHERE source_memo = 
  , [batchTag]);
  console.log(JSON.stringify({
    ok: true,
    batchTag,
    backup,
    before: before.rows[0],
    deleted_count: deleted.rowCount,
    deleted: deleted.rows,
    after: after.rows[0]
  }, null, 2));
}
main()
  .catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
'@
$RunnerJs | Set-Content -LiteralPath $Runner -Encoding UTF8
$RuntimePath = Join-Path $ProjectRoot "HD_ORIGIN_RUNTIME_PATHS.txt"
$NodePath = "node"
if (Test-Path -LiteralPath $RuntimePath) {
  $RuntimeText = Get-Content -LiteralPath $RuntimePath -Raw -Encoding UTF8
  $NodeLine = ($RuntimeText -split "?
" | Where-Object { $_ -like "NODE_PATH=*" } | Select-Object -First 1)
  if ($NodeLine) {
    $Candidate = $NodeLine.Substring(10).Trim()
    if (Test-Path -LiteralPath $Candidate) {
      $NodePath = $Candidate
    }
  }
}
$Result = & $NodePath $Runner $ProjectRoot "HD_ORIGIN_PAYABLE_DUMMY_BATCH_20260706_205524" 2>&1
$Result -join "
" | Write-Host