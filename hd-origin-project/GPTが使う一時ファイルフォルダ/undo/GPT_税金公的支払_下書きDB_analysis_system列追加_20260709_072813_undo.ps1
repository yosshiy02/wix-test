cd "G:\GITHUB\wix-test\hd-origin-project"
$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$ResultTxt = Join-Path "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\memo" "GPT_税金公的支払_analysis_system列追加_undo_result_20260709_072813.txt"
$CheckJs = Join-Path "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\memo" "GPT_税金公的支払_analysis_system列追加_undo_20260709_072813.js"

$Js = @'
const fs = require("fs");
const path = require("path");
const projectRoot = process.cwd();
const outPath = process.argv[2];
const db = require(path.join(projectRoot, "web_receiver", "src", "db"));

(async () => {
  const lines = [];
  lines.push("==============================");
  lines.push("analysis_system_* 列追加 UNDO 結果");
  lines.push("==============================");
  lines.push("日時: " + new Date().toLocaleString("ja-JP"));
  lines.push("");

  await db.query(
    ALTER TABLE accounting.payment_document_sorting_drafts
      DROP COLUMN IF EXISTS analysis_system_code,
      DROP COLUMN IF EXISTS analysis_system_label,
      DROP COLUMN IF EXISTS analysis_system_reason,
      DROP COLUMN IF EXISTS analysis_system_confidence
  );

  lines.push("analysis_system_* 4列を削除しました。");
  lines.push("注意: このUNDOは保存済みの analysis_system_* 値も消します。");

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

Write-Host "OK: analysis_system_* 4列追加をUNDOしました。"
