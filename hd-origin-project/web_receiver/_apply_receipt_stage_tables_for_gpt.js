const fs = require("fs");
const dotenv = require("dotenv");
const { Pool } = require("pg");

const envPath = process.argv[2];
const reportPath = process.argv[3];
const dbHost = process.argv[4];
const dbPort = process.argv[5];
const dbName = process.argv[6];
const dbUser = process.argv[7];
const safetyBackup = process.argv[8];

dotenv.config({ path: envPath, override: true });

const dbPassword = String(process.env.DB_PASSWORD || "");

const pool = new Pool({
  host: dbHost,
  port: Number(dbPort),
  database: dbName,
  user: dbUser,
  password: dbPassword
});

const sql = `
begin;

create table if not exists expenses.receipt_imports (
  receipt_import_id bigserial primary key,
  import_source text not null default 'local',
  import_status text not null default 'draft',
  original_file_name text,
  display_file_name text,
  receipt_date date,
  vendor_name text,
  total_amount numeric not null default 0,
  tax_amount numeric,
  invoice_number text,
  payment_method_id bigint,
  payment_method_name text,
  target_person_id bigint,
  target_person text,
  purpose_id bigint,
  purpose text,
  project_id bigint,
  project_name text,
  department_id bigint,
  department_name text,
  evidence_type text,
  evidence_memo text,
  summary text,
  ocr_provider text,
  ocr_status text,
  ocr_raw_text text,
  ai_status text,
  error_message text,
  confirmed_expense_id bigint references expenses.expense_headers(expense_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint receipt_imports_import_status_check check (
    import_status in (
      'draft',
      'file_pending',
      'file_saved',
      'sync_pending',
      'ready',
      'confirmed',
      'imported',
      'duplicate',
      'cancelled',
      'error'
    )
  )
);

create table if not exists expenses.receipt_files (
  receipt_file_id bigserial primary key,
  receipt_import_id bigint not null references expenses.receipt_imports(receipt_import_id) on delete cascade,
  file_role text not null default 'receipt_image',
  storage_root_key text not null default 'HD_ORIGIN_RECEIPT_ROOT',
  original_file_name text,
  stored_file_name text not null,
  relative_path text not null,
  mime_type text,
  file_size bigint,
  sha256 text,
  file_status text not null default 'file_pending',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receipt_files_file_status_check check (
    file_status in (
      'file_pending',
      'file_saved',
      'sync_pending',
      'ready',
      'missing',
      'error'
    )
  )
);

create table if not exists expenses.receipt_ai_drafts (
  receipt_ai_draft_id bigserial primary key,
  receipt_import_id bigint not null references expenses.receipt_imports(receipt_import_id) on delete cascade,
  ai_provider text,
  ai_model text,
  draft_status text not null default 'draft',
  raw_json jsonb,
  suggested_receipt_date date,
  suggested_vendor_name text,
  suggested_total_amount numeric,
  suggested_tax_amount numeric,
  suggested_invoice_number text,
  suggested_payment_method_name text,
  suggested_target_person text,
  suggested_purpose text,
  suggested_project_name text,
  suggested_department_name text,
  suggested_evidence_type text,
  suggested_summary text,
  confidence numeric,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receipt_ai_drafts_draft_status_check check (
    draft_status in (
      'draft',
      'suggested',
      'accepted',
      'rejected',
      'error'
    )
  )
);

create index if not exists idx_receipt_imports_status
  on expenses.receipt_imports(import_status);

create index if not exists idx_receipt_imports_receipt_date
  on expenses.receipt_imports(receipt_date);

create index if not exists idx_receipt_imports_confirmed_expense
  on expenses.receipt_imports(confirmed_expense_id);

create index if not exists idx_receipt_files_import_id
  on expenses.receipt_files(receipt_import_id);

create index if not exists idx_receipt_files_relative_path
  on expenses.receipt_files(relative_path);

create index if not exists idx_receipt_files_sha256
  on expenses.receipt_files(sha256);

create index if not exists idx_receipt_files_status
  on expenses.receipt_files(file_status);

create index if not exists idx_receipt_ai_drafts_import_id
  on expenses.receipt_ai_drafts(receipt_import_id);

commit;
`;

async function tableInfo(tableName) {
  const [schema, table] = tableName.split(".");

  const cols = await pool.query(`
    select ordinal_position, column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = $1 and table_name = $2
    order by ordinal_position
  `, [schema, table]);

  const count = await pool.query(`select count(*)::int as count from ${schema}.${table}`);

  return { cols: cols.rows, count: count.rows[0].count };
}

async function main() {
  const lines = [];

  lines.push("DB レシート取込テーブル作成結果");
  lines.push("================================");
  lines.push("");
  lines.push("実行日時: " + new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
  lines.push("ENV_PATH: " + envPath);
  lines.push("DB_HOST: " + dbHost);
  lines.push("DB_PORT: " + dbPort);
  lines.push("DB_NAME: " + dbName);
  lines.push("DB_USER: " + dbUser);
  lines.push("DB_PASSWORD: " + (dbPassword ? "********" : "未設定"));
  lines.push("");
  lines.push("変更前安全バックアップ:");
  lines.push(safetyBackup);
  lines.push("");

  const client = await pool.connect();

  try {
    await client.query(sql);
  } finally {
    client.release();
  }

  lines.push("[作成結果]");
  lines.push("OK");
  lines.push("");

  const targets = [
    "expenses.receipt_imports",
    "expenses.receipt_files",
    "expenses.receipt_ai_drafts"
  ];

  for (const target of targets) {
    const info = await tableInfo(target);

    lines.push("------------------------------------------------------------");
    lines.push("[" + target + "]");
    lines.push("件数: " + info.count);
    lines.push("");
    lines.push("カラム:");

    for (const col of info.cols) {
      lines.push(
        String(col.ordinal_position).padStart(2, "0") + ". " +
        col.column_name + " / " +
        col.data_type + " / nullable=" + col.is_nullable +
        (col.column_default ? " / default=" + col.column_default : "")
      );
    }

    lines.push("");
  }

  lines.push("[設計メモ]");
  lines.push("- DBが正本");
  lines.push("- Dropboxは共有保管場所");
  lines.push("- 画像の絶対パスではなく relative_path を保存する");
  lines.push("- file_status で Dropbox同期遅延・欠落を検出する");
  lines.push("- 正式経費登録時は confirmed_expense_id で expense_headers と紐付ける");
  lines.push("");

  fs.writeFileSync(reportPath, lines.join("\r\n"), "utf8");
}

main()
  .catch(err => {
    const lines = [];

    lines.push("DB レシート取込テーブル作成 エラー");
    lines.push("==================================");
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
