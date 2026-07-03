const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");
const { Pool } = require("pg");

const envPath = process.argv[2];
const reportPath = process.argv[3];
const dbHost = process.argv[4];
const dbPort = process.argv[5];
const dbName = process.argv[6];
const dbUser = process.argv[7];
const safetyBackup = process.argv[8];
const receiptRoot = process.argv[9];

dotenv.config({ path: envPath, override: true });

const dbPassword = String(process.env.DB_PASSWORD || "");

const pool = new Pool({
  host: dbHost,
  port: Number(dbPort),
  database: dbName,
  user: dbUser,
  password: dbPassword
});

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

function guessMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();

  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";

  return "application/octet-stream";
}

function listTargetFiles() {
  const targets = [];

  const folders = [
    { folder: "imported", importStatus: "ready" },
    { folder: "duplicate", importStatus: "duplicate" }
  ];

  for (const item of folders) {
    const dir = path.join(receiptRoot, item.folder);

    if (!fs.existsSync(dir)) {
      continue;
    }

    const names = fs.readdirSync(dir)
      .filter(name => name !== ".gitkeep")
      .sort((a, b) => a.localeCompare(b, "ja"));

    for (const name of names) {
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);

      if (!stat.isFile()) {
        continue;
      }

      targets.push({
        folder: item.folder,
        importStatus: item.importStatus,
        fileName: name,
        fullPath,
        relativePath: path.join(item.folder, name).replaceAll("\\", "/"),
        size: stat.size,
        mimeType: guessMimeType(name),
        sha256: sha256File(fullPath)
      });
    }
  }

  return targets;
}

async function main() {
  const lines = [];

  lines.push("DB 既存レシート画像登録結果");
  lines.push("============================");
  lines.push("");
  lines.push("実行日時: " + new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
  lines.push("ENV_PATH: " + envPath);
  lines.push("DB_HOST: " + dbHost);
  lines.push("DB_PORT: " + dbPort);
  lines.push("DB_NAME: " + dbName);
  lines.push("DB_USER: " + dbUser);
  lines.push("DB_PASSWORD: " + (dbPassword ? "********" : "未設定"));
  lines.push("RECEIPT_ROOT: " + receiptRoot);
  lines.push("");
  lines.push("変更前安全バックアップ:");
  lines.push(safetyBackup);
  lines.push("");

  const files = listTargetFiles();

  lines.push("[登録対象]");
  lines.push("対象ファイル数: " + files.length);
  for (const f of files) {
    lines.push("- " + f.relativePath + " / " + f.size + " bytes / sha256=" + f.sha256);
  }
  lines.push("");

  const client = await pool.connect();

  const inserted = [];
  const skipped = [];
  const errors = [];

  try {
    await client.query("begin");

    for (const f of files) {
      const existing = await client.query(`
        select
          rf.receipt_file_id,
          rf.receipt_import_id,
          rf.relative_path,
          rf.file_size,
          rf.sha256,
          ri.import_status
        from expenses.receipt_files rf
        join expenses.receipt_imports ri
          on ri.receipt_import_id = rf.receipt_import_id
        where rf.relative_path = $1
           or (rf.sha256 is not null and rf.sha256 = $2)
        order by rf.receipt_file_id
        limit 1
      `, [f.relativePath, f.sha256]);

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        skipped.push({
          relativePath: f.relativePath,
          reason: "既にDB登録あり",
          receipt_import_id: row.receipt_import_id,
          receipt_file_id: row.receipt_file_id
        });
        continue;
      }

      const importResult = await client.query(`
        insert into expenses.receipt_imports (
          import_source,
          import_status,
          original_file_name,
          display_file_name,
          total_amount,
          evidence_type,
          summary,
          created_at,
          updated_at
        )
        values (
          'existing_file_migration',
          $1,
          $2,
          $2,
          0,
          'receipt',
          $3,
          now(),
          now()
        )
        returning receipt_import_id
      `, [
        f.importStatus,
        f.fileName,
        "既存レシート画像のDB台帳登録: " + f.relativePath
      ]);

      const receiptImportId = importResult.rows[0].receipt_import_id;

      const fileResult = await client.query(`
        insert into expenses.receipt_files (
          receipt_import_id,
          file_role,
          storage_root_key,
          original_file_name,
          stored_file_name,
          relative_path,
          mime_type,
          file_size,
          sha256,
          file_status,
          last_checked_at,
          created_at,
          updated_at
        )
        values (
          $1,
          'receipt_image',
          'HD_ORIGIN_RECEIPT_ROOT',
          $2,
          $2,
          $3,
          $4,
          $5,
          $6,
          'ready',
          now(),
          now(),
          now()
        )
        returning receipt_file_id
      `, [
        receiptImportId,
        f.fileName,
        f.relativePath,
        f.mimeType,
        f.size,
        f.sha256
      ]);

      inserted.push({
        relativePath: f.relativePath,
        importStatus: f.importStatus,
        receipt_import_id: receiptImportId,
        receipt_file_id: fileResult.rows[0].receipt_file_id
      });
    }

    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    errors.push(err.stack || err.message);
  } finally {
    client.release();
  }

  lines.push("[DB登録結果]");
  lines.push("登録: " + inserted.length);
  for (const item of inserted) {
    lines.push(
      "  INSERTED: " +
      item.relativePath +
      " / import_status=" +
      item.importStatus +
      " / receipt_import_id=" +
      item.receipt_import_id +
      " / receipt_file_id=" +
      item.receipt_file_id
    );
  }

  lines.push("");
  lines.push("スキップ: " + skipped.length);
  for (const item of skipped) {
    lines.push(
      "  SKIPPED: " +
      item.relativePath +
      " / " +
      item.reason +
      " / receipt_import_id=" +
      item.receipt_import_id +
      " / receipt_file_id=" +
      item.receipt_file_id
    );
  }

  lines.push("");
  lines.push("エラー: " + errors.length);
  if (errors.length === 0) {
    lines.push("  なし");
  } else {
    for (const err of errors) {
      lines.push(err);
    }
  }

  lines.push("");

  const counts = await pool.query(`
    select
      ri.import_status,
      rf.file_status,
      count(*)::int as count
    from expenses.receipt_imports ri
    join expenses.receipt_files rf
      on rf.receipt_import_id = ri.receipt_import_id
    group by ri.import_status, rf.file_status
    order by ri.import_status, rf.file_status
  `);

  lines.push("[登録後件数]");
  for (const row of counts.rows) {
    lines.push(
      "- import_status=" +
      row.import_status +
      " / file_status=" +
      row.file_status +
      " / count=" +
      row.count
    );
  }

  lines.push("");
  lines.push("[注意]");
  lines.push("- 画像ファイルは移動・削除していません。");
  lines.push("- 旧ローカル側も残したままです。");
  lines.push("- 正式経費 expense_headers / expense_details にはまだ登録していません。");
  lines.push("- DBには relative_path / sha256 / file_size / file_status を登録しました。");

  fs.writeFileSync(reportPath, lines.join("\r\n"), "utf8");
}

main()
  .catch(err => {
    const lines = [];
    lines.push("DB 既存レシート画像登録 エラー");
    lines.push("==============================");
    lines.push("");
    lines.push("変更前安全バックアップ:");
    lines.push(safetyBackup);
    lines.push("");
    lines.push(err.stack || err.message);

    fs.writeFileSync(reportPath, lines.join("\r\n"), "utf8");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
