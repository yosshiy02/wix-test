$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project"
$WebDir = Join-Path $ProjectRoot "web_receiver"
$UndoSql = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\undo\GPT2_契約保険リース_専門下書きDB設計_20260708_204945_undo.sql"
$ResultPath = Join-Path "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\memo" "GPT2_契約保険リース_専門下書きDB設計_20260708_204945_undo_result.txt"

$RuntimePath = Join-Path $ProjectRoot "HD_ORIGIN_RUNTIME_PATHS.txt"
$Runtime = @{}
Get-Content -LiteralPath $RuntimePath -Encoding UTF8 | ForEach-Object {
    if ($_ -match "^\s*([^#=]+?)=(.*)$") {
        $Runtime[$Matches[1].Trim()] = $Matches[2].Trim()
    }
}

$NodePath = $Runtime["NODE_PATH"]
if (-not $NodePath -or -not (Test-Path -LiteralPath $NodePath)) {
    $NodePath = "node"
}

$UndoJs = Join-Path "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPT2が使う一時ファイルフォルダ\undo" "GPT2_契約保険リース_専門下書きDB設計_20260708_204945_undo.js"

$Js = @'
const fs = require("fs");
const path = require("path");

const projectRoot = process.argv[2];
const sqlPath = process.argv[3];
const resultPath = process.argv[4];

const webDir = path.join(projectRoot, "web_receiver");
process.chdir(webDir);

const db = require(path.join(webDir, "src", "db"));

async function main() {
  const sql = fs.readFileSync(sqlPath, "utf8");
  await db.query(sql);
  fs.writeFileSync(resultPath, "OK: 契約・保険・リース専門下書きテーブルをDROPしました。\r\n", "utf8");
  await db.end();
}

main().catch(async err => {
  fs.writeFileSync(resultPath, String(err && err.stack ? err.stack : err), "utf8");
  try { await db.end(); } catch {}
  process.exit(1);
});
'@

Set-Content -LiteralPath $UndoJs -Value $Js -Encoding UTF8

& $NodePath $UndoJs $ProjectRoot $UndoSql $ResultPath
notepad $ResultPath
