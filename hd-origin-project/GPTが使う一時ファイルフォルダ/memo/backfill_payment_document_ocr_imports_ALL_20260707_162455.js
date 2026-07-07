const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = "C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project";

const config = require(path.join(PROJECT_ROOT, "web_receiver", "src", "config"));
const db = require(path.join(PROJECT_ROOT, "web_receiver", "src", "db"));

function textOrEmpty(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function dateOrNull(value) {
  const text = textOrEmpty(value);
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

function walkMetaFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const out = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      out.push(...walkMetaFiles(full));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".meta.json")) {
      out.push(full);
    }
  }

  return out;
}

function relPaymentDocumentPath(filePath) {
  return path.relative(config.paymentDocumentRoot, filePath).replace(/\\/g, "/");
}

function pickOcrText(meta) {
  return textOrEmpty(
    meta.ocrRawText ||
    meta.ocr_raw_text ||
    meta.ocrText ||
    meta.rawText ||
    (meta.ocr && meta.ocr.rawText) ||
    (meta.ocr && meta.ocr.text) ||
    ""
  );
}

function documentKeyFromMeta(meta, metaPath) {
  const relMetaPath = relPaymentDocumentPath(metaPath);
  const savedRelativePath = textOrEmpty(meta.savedRelativePath);
  const savedMetaRelativePath = textOrEmpty(meta.savedMetaRelativePath) || relMetaPath;
  const sha256 = textOrEmpty(meta.sha256 || meta.fileSha256 || meta.contentHash);
  const savedFileName = textOrEmpty(meta.savedFileName || path.basename(metaPath).replace(/\.meta\.json$/, ""));

  if (savedRelativePath) return "saved:" + savedRelativePath;
  if (savedMetaRelativePath) return "meta:" + savedMetaRelativePath;
  if (sha256) return "sha256:" + sha256;

  return "file:" + savedFileName;
}

async function ensureTableExists() {
  const result = await db.query(`
    SELECT to_regclass('accounting.payment_document_ocr_imports') AS table_name
  `);

  if (!result.rows[0] || !result.rows[0].table_name) {
    throw new Error("accounting.payment_document_ocr_imports が存在しません。先にDBロード化マイグレーションが必要です。");
  }
}

async function upsert(meta, metaPath) {
  const ocrText = pickOcrText(meta);

  if (!ocrText) {
    return {
      imported: false,
      reason: "ocr_text_empty"
    };
  }

  const relMetaPath = relPaymentDocumentPath(metaPath);
  const savedFileName = textOrEmpty(
    meta.savedFileName ||
    meta.fileName ||
    path.basename(metaPath).replace(/\.meta\.json$/, "")
  );

  const originalFileName = textOrEmpty(
    meta.originalFileName ||
    meta.original_file_name ||
    savedFileName
  );

  const documentKey = documentKeyFromMeta(meta, metaPath);

  const sha256 = textOrEmpty(
    meta.sha256 ||
    meta.fileSha256 ||
    meta.contentHash
  );

  const sourceType = textOrEmpty(
    meta.sourceType ||
    meta.source_type ||
    (
      relMetaPath.includes("scan-inbox") ? "scan_inbox" :
      relMetaPath.includes("saved") ? "saved" :
      "payment_documents"
    )
  );

  const saveStatus = textOrEmpty(
    meta.saveStatus ||
    meta.savedStatus ||
    (
      relMetaPath.includes("saved") ? "saved" :
      relMetaPath.includes("scan-inbox") ? "scan_inbox" :
      ""
    )
  );

  await db.query(`
    INSERT INTO accounting.payment_document_ocr_imports (
      document_key,
      original_file_name,
      saved_file_name,
      mime_type,
      size_bytes,
      sha256,
      document_type,
      destination,
      source_type,
      vendor_name,
      note,
      email_subject,
      email_from,
      email_received_at,
      ocr_status,
      ocr_provider,
      ocr_api_version,
      ocr_at,
      ocr_raw_text,
      ocr_text_length,
      ocr_error,
      process_status,
      save_status,
      evidence_saved,
      ocr_saved,
      saved_relative_path,
      saved_meta_relative_path,
      saved_at,
      saved_by_page
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
      $21,$22,$23,$24,$25,$26,$27,$28,$29
    )
    ON CONFLICT (document_key)
    DO UPDATE SET
      original_file_name = EXCLUDED.original_file_name,
      saved_file_name = EXCLUDED.saved_file_name,
      mime_type = EXCLUDED.mime_type,
      size_bytes = EXCLUDED.size_bytes,
      sha256 = EXCLUDED.sha256,
      document_type = EXCLUDED.document_type,
      destination = EXCLUDED.destination,
      source_type = EXCLUDED.source_type,
      vendor_name = EXCLUDED.vendor_name,
      note = EXCLUDED.note,
      email_subject = EXCLUDED.email_subject,
      email_from = EXCLUDED.email_from,
      email_received_at = EXCLUDED.email_received_at,
      ocr_status = EXCLUDED.ocr_status,
      ocr_provider = EXCLUDED.ocr_provider,
      ocr_api_version = EXCLUDED.ocr_api_version,
      ocr_at = EXCLUDED.ocr_at,
      ocr_raw_text = EXCLUDED.ocr_raw_text,
      ocr_text_length = EXCLUDED.ocr_text_length,
      ocr_error = EXCLUDED.ocr_error,
      process_status = EXCLUDED.process_status,
      save_status = EXCLUDED.save_status,
      evidence_saved = EXCLUDED.evidence_saved,
      ocr_saved = EXCLUDED.ocr_saved,
      saved_relative_path = EXCLUDED.saved_relative_path,
      saved_meta_relative_path = EXCLUDED.saved_meta_relative_path,
      saved_at = EXCLUDED.saved_at,
      saved_by_page = EXCLUDED.saved_by_page,
      deleted_at = NULL,
      updated_at = now()
  `, [
    documentKey,
    originalFileName,
    savedFileName,
    textOrEmpty(meta.mimeType),
    Number(meta.sizeBytes || 0),
    sha256,
    textOrEmpty(meta.documentType),
    textOrEmpty(meta.destination),
    sourceType,
    textOrEmpty(meta.vendorName),
    textOrEmpty(meta.note),
    textOrEmpty(meta.emailSubject),
    textOrEmpty(meta.emailFrom),
    textOrEmpty(meta.emailReceivedAt),
    textOrEmpty(meta.ocrStatus || "ocr_done"),
    textOrEmpty(meta.ocrProvider),
    textOrEmpty(meta.ocrApiVersion),
    dateOrNull(meta.ocrAt || meta.createdAt || meta.savedAt),
    ocrText,
    ocrText.length,
    textOrEmpty(meta.ocrError),
    textOrEmpty(meta.processStatus),
    saveStatus,
    !!meta.evidenceSaved,
    !!meta.ocrSaved || !!ocrText,
    textOrEmpty(meta.savedRelativePath),
    textOrEmpty(meta.savedMetaRelativePath) || relMetaPath,
    dateOrNull(meta.savedAt),
    textOrEmpty(meta.savedByPage)
  ]);

  return {
    imported: true,
    reason: "ok"
  };
}

async function main() {
  await ensureTableExists();

  const rootDir = config.paymentDocumentRoot;
  const metaFiles = walkMetaFiles(rootDir);

  let imported = 0;
  let skipped = 0;
  const skipReasons = {};
  const folders = {};

  for (const metaPath of metaFiles) {
    const rel = relPaymentDocumentPath(metaPath);
    const topFolder = rel.split("/")[0] || "(root)";
    folders[topFolder] = (folders[topFolder] || 0) + 1;

    const meta = readJsonSafe(metaPath);

    if (!meta) {
      skipped++;
      skipReasons.json_read_error = (skipReasons.json_read_error || 0) + 1;
      continue;
    }

    const result = await upsert(meta, metaPath);

    if (result.imported) {
      imported++;
    } else {
      skipped++;
      skipReasons[result.reason] = (skipReasons[result.reason] || 0) + 1;
    }
  }

  const countResult = await db.query(`
    SELECT COUNT(*)::INTEGER AS count
    FROM accounting.payment_document_ocr_imports
    WHERE deleted_at IS NULL
      AND COALESCE(ocr_raw_text, '') <> ''
  `);

  const sampleResult = await db.query(`
    SELECT
      payment_document_ocr_import_id AS id,
      original_file_name,
      saved_file_name,
      source_type,
      save_status,
      ocr_text_length,
      LEFT(ocr_raw_text, 80) AS preview
    FROM accounting.payment_document_ocr_imports
    WHERE deleted_at IS NULL
      AND COALESCE(ocr_raw_text, '') <> ''
    ORDER BY payment_document_ocr_import_id DESC
    LIMIT 10
  `);

  console.log(JSON.stringify({
    ok: true,
    rootDir,
    metaFiles: metaFiles.length,
    folders,
    imported,
    skipped,
    skipReasons,
    dbCount: countResult.rows[0].count,
    samples: sampleResult.rows
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });