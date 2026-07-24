# ============================================================
# GPT00 current_status 共通フィールド追加取消
# DB構造更新あり / Windows PowerShell 5.1対応
# ============================================================

$ErrorActionPreference = "Stop"

[Console]::InputEncoding  = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding           = New-Object System.Text.UTF8Encoding($false)
chcp 65001 | Out-Null

$ProjectRoot = "G:\GITHUB\wix-test\hd-origin-project"
$WebDir      = Join-Path $ProjectRoot "web_receiver"
$NodePath    = "G:\Apps\NodeJS\node.exe"
$DbModule    = Join-Path $WebDir "src\db.js"
$TempJs      = Join-Path $env:TEMP "undo_payment_document_current_status.js"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

try {
    $Js = @"
"use strict";

const path = require("path");

async function main() {
  const db = require(path.resolve(process.argv[2]));

  const query =
    typeof db.query === "function"
      ? db.query.bind(db)
      : db.pool && typeof db.pool.query === "function"
        ? db.pool.query.bind(db.pool)
        : null;

  if (!query) {
    throw new Error("DB query関数を取得できません。");
  }

  await query("BEGIN");

  try {
    await query(`
      ALTER TABLE accounting.payment_document_ocr_imports
      DROP CONSTRAINT IF EXISTS
        chk_payment_document_ocr_imports_current_status
    `);

    await query(`
      ALTER TABLE accounting.payment_document_ocr_imports
      DROP COLUMN IF EXISTS current_status
    `);

    await query("COMMIT");
  } catch (error) {
    await query("ROLLBACK");
    throw error;
  }

  console.log("UNDO_STATUS=SUCCESS");

  if (db.pool && typeof db.pool.end === "function") {
    await db.pool.end();
  }
}

main().catch((error) => {
  console.error("UNDO_STATUS=FAILED");
  console.error(
    "FAILED_MESSAGE=" +
      String(error && error.message ? error.message : error)
  );
  process.exitCode = 1;
});
"@

    [System.IO.File]::WriteAllText(
        $TempJs,
        $Js,
        $Utf8NoBom
    )

    $Output = @(
        & $NodePath $TempJs $DbModule 2>&1
    )

    $ExitCode = $LASTEXITCODE
    $Message = $Output -join [Environment]::NewLine

    Write-Host $Message
    Set-Clipboard -Value $Message

    if ($ExitCode -ne 0) {
        throw "取消処理に失敗しました。EXIT_CODE=$ExitCode"
    }
}
catch {
    $Message = @"
UNDO_STATUS=FAILED
FAILED_MESSAGE=$($_.Exception.Message)
ERROR_TYPE=$($_.Exception.GetType().FullName)
ERROR_POSITION=$($_.InvocationInfo.PositionMessage)
"@

    Write-Host $Message
    Set-Clipboard -Value $Message
}
finally {
    if (Test-Path -LiteralPath $TempJs -PathType Leaf) {
        Remove-Item -LiteralPath $TempJs -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "このPowerShell画面は閉じません。"