cd "G:\GITHUB\wix-test\hd-origin-project"
$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$MigrationSrc = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\database\migrations\20260709_001_payment_document_sorting_drafts_analysis_system_columns.sql"
$MigrationDst = Join-Path $ProjectRoot "database\migrations\20260709_001_payment_document_sorting_drafts_analysis_system_columns.sql"

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $MigrationDst) | Out-Null
Copy-Item -LiteralPath $MigrationSrc -Destination $MigrationDst -Force

$CheckJs = Join-Path "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\memo" "GPT_税金公的支払_analysis_system列追加_apply_check_20260709_072813.js"
$ResultTxt = Join-Path "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\memo" "GPT_税金公的支払_analysis_system列追加_apply_result_20260709_072813.txt"

$Js = @'
const fs = require("fs");
const path = require("path");
const projectRoot = process.cwd();
const outPath = process.argv[2];
const db = require(path.join(projectRoot, "web_receiver", "src", "db"));

(async () => {
  const lines = [];
  lines.push("==============================");
  lines.push("analysis_system_* 列追加 apply 結果");
  lines.push("==============================");
  lines.push("日時: " + new Date().toLocaleString("ja-JP"));
  lines.push("");

  const sql = fs.readFileSync(path.join(projectRoot, "database", "migrations", "20260709_001_payment_document_sorting_drafts_analysis_system_columns.sql"), "utf8");
  await db.query(sql);

  const result = await db.query(
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'payment_document_sorting_drafts'
      AND column_name IN (
        'analysis_system_code',
        'analysis_system_label',
        'analysis_system_reason',
        'analysis_system_confidence'
      )
    ORDER BY column_name
  );

  lines.push("[追加後の列確認]");
  for (const row of result.rows) {
    lines.push("- " + row.column_name + " : " + row.data_type);
  }

  if (result.rows.length !== 4) {
    throw new Error("analysis_system_* 4列の確認に失敗しました。確認できた列数: " + result.rows.length);
  }

  fs.writeFileSync(outPath, lines.join("\r\n"), "utf8");
  await db.end?.();
})().catch(async err => {
  fs.writeFileSync(outPath, "ERROR:\r\n" + (err && err.stack ? err.stack : String(err)), "utf8");
  try { await db.end?.(); } catch {}
  process.exit(1);
});
'@

$Js | Set-Content -LiteralPath $CheckJs -Encoding UTF8

$NodePath = "node"
$RuntimePathFile = Join-Path $ProjectRoot "HD_ORIGIN_RUNTIME_PATHS.txt"
if (Test-Path -LiteralPath $RuntimePathFile) {
  $NodeLine = Get-Content -LiteralPath $RuntimePathFile -Encoding UTF8 |
    Where-Object { $_ -match "^NODE_PATH=" } |
    Select-Object -First 1

  if ($NodeLine) {
    $CandidateNode = $NodeLine -replace "^NODE_PATH=", ""
    if ($CandidateNode -and (Test-Path -LiteralPath $CandidateNode)) {
      $NodePath = $CandidateNode
    }
  }
}

& $NodePath $CheckJs $ResultTxt

notepad $ResultTxt

Write-Host "OK: payment_document_sorting_drafts に analysis_system_* 4列を追加しました。GPT2側は未使用。"
