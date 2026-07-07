const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");
const { sendJson } = require("../response");
const db = require("../db");

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const AZURE_API_VERSION = "2024-11-30";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function paymentDocumentRoot() {
  const dir = config.paymentDocumentRoot || path.join(config.projectRoot, "storage", "payment-documents");
  ensureDir(dir);
  return dir;
}

function inboxDir() {
  const dir = path.join(paymentDocumentRoot(), "scan-inbox");
  ensureDir(dir);
  return dir;
}

function savedBaseDir() {
  const dir = path.join(paymentDocumentRoot(), "saved");
  ensureDir(dir);
  return dir;
}

function savedYearMonth(value) {
  const d = value ? new Date(value) : new Date();

  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return String(now.getFullYear()) + "-" + String(now.getMonth() + 1).padStart(2, "0");
  }

  return String(d.getFullYear()) + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function savedDirForMeta(meta) {
  const ym = savedYearMonth(meta.documentDate || meta.ocrAt || meta.savedAt || meta.uploadedAt || new Date().toISOString());
  const dir = path.join(savedBaseDir(), ym);
  ensureDir(dir);
  return dir;
}

function relativePaymentDocumentPath(filePath) {
  return path.relative(paymentDocumentRoot(), filePath).replace(/\\/g, "/");
}

/* PAYMENT_DOCUMENT_OCR_IMPORT_IMAGE_FILE_20260707_START */
function safePaymentDocumentFilePathFromRelative(relativePath) {
  const root = path.resolve(paymentDocumentRoot());
  const rel = String(relativePath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();

  if (!rel) return null;
  if (rel.includes("\0")) return null;
  if (rel.split("/").includes("..")) return null;

  const filePath = path.resolve(root, rel);

  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return null;
  }

  return filePath;
}

function paymentDocumentFilePathFromOcrImportRow(row) {
  const candidates = [];

  if (row.saved_relative_path) {
    candidates.push(row.saved_relative_path);
  }

  if (row.saved_meta_relative_path) {
    const metaRel = String(row.saved_meta_relative_path || "").replace(/\\/g, "/");

    if (metaRel.endsWith(".meta.json")) {
      candidates.push(metaRel.slice(0, -".meta.json".length));
    }
  }

  if (row.source_type === "scan_inbox" && row.saved_file_name) {
    candidates.push("scan-inbox/" + row.saved_file_name);
  }

  for (const rel of candidates) {
    const filePath = safePaymentDocumentFilePathFromRelative(rel);

    if (filePath && fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}
/* PAYMENT_DOCUMENT_OCR_IMPORT_IMAGE_FILE_20260707_END */


function uniqueFilePath(dir, fileName) {
  const safe = safeFileName(fileName || "payment-document");
  const parsed = path.parse(safe);
  let candidate = path.join(dir, parsed.base);
  let count = 2;

  while (fs.existsSync(candidate) || fs.existsSync(metaPathFor(candidate))) {
    candidate = path.join(dir, parsed.name + "_" + count + parsed.ext);
    count++;
  }

  return candidate;
}

function moveFileAllowCrossDevice(sourcePath, targetPath) {
  try {
    fs.renameSync(sourcePath, targetPath);
    return;
  } catch (err) {
    if (!err || err.code !== "EXDEV") {
      throw err;
    }

    fs.copyFileSync(sourcePath, targetPath);
    fs.unlinkSync(sourcePath);
  }
}

function movePaymentDocumentToSaved(filePath, meta) {
  const sourceMetaPath = metaPathFor(filePath);
  const targetDir = savedDirForMeta(meta);
  const targetPath = uniqueFilePath(targetDir, path.basename(filePath));
  const targetMetaPath = metaPathFor(targetPath);
  const now = new Date().toISOString();

  const finalMeta = {
    ...meta,
    originalInboxFileName: meta.originalInboxFileName || path.basename(filePath),
    savedFileName: path.basename(targetPath),
    storageRoot: "paymentDocumentRoot",
    storageFolder: "saved",
    storageStatus: "saved",
    savedRelativePath: relativePaymentDocumentPath(targetPath),
    savedMetaRelativePath: relativePaymentDocumentPath(targetMetaPath),
    savedAt: meta.savedAt || now,
    movedToSavedAt: now
  };

  writeJson(sourceMetaPath, finalMeta);

  moveFileAllowCrossDevice(filePath, targetPath);

  if (fs.existsSync(sourceMetaPath)) {
    moveFileAllowCrossDevice(sourceMetaPath, targetMetaPath);
  }

  writeJson(targetMetaPath, finalMeta);

  return {
    fileName: path.basename(targetPath),
    originalFileName: finalMeta.originalFileName || path.basename(targetPath),
    savedRelativePath: finalMeta.savedRelativePath,
    savedMetaRelativePath: finalMeta.savedMetaRelativePath,
    savedAt: finalMeta.savedAt
  };
}

function safeFileName(value) {
  const raw = String(value || "payment-document").trim();
  const base = raw
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^\.+/g, "")
    .slice(0, 180);

  return base || "payment-document";
}

function timestampPrefix() {
  const d = new Date();
  const z = n => String(n).padStart(2, "0");

  return [
    d.getFullYear(),
    z(d.getMonth() + 1),
    z(d.getDate())
  ].join("") + "_" + [
    z(d.getHours()),
    z(d.getMinutes()),
    z(d.getSeconds())
  ].join("") + "_" + String(d.getMilliseconds()).padStart(3, "0");
}

function metaPathFor(filePath) {
  return filePath + ".meta.json";
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}
function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function findDuplicateInboxItem(fileHash, sizeBytes) {
  const dir = inboxDir();
  const targetHash = String(fileHash || "").trim().toLowerCase();

  if (!targetHash) {
    return null;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .filter(entry => !isHiddenSidecar(entry.name));

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    const stat = fs.statSync(filePath);

    if (Number(sizeBytes) > 0 && stat.size !== Number(sizeBytes)) {
      continue;
    }

    const metaPath = metaPathFor(filePath);
    const meta = readJsonSafe(metaPath) || {};
    let existingHash = String(meta.sha256 || meta.fileSha256 || meta.contentHash || "").trim().toLowerCase();

    if (!existingHash) {
      existingHash = sha256File(filePath);

      writeJson(metaPath, {
        ...meta,
        sha256: existingHash,
        fileSha256: existingHash,
        duplicateCheckedAt: new Date().toISOString()
      });
    }

    if (existingHash === targetHash) {
      return {
        fileName: entry.name,
        originalFileName: meta.originalFileName || entry.name,
        mimeType: meta.mimeType || getMimeType(entry.name),
        sizeBytes: stat.size,
        uploadedAt: meta.uploadedAt || "",
        ocrStatus: meta.ocrStatus || "",
        processStatus: meta.processStatus || ""
      };
    }
  }

  return null;
}

function getMimeType(fileName) {
  const ext = path.extname(String(fileName || "")).toLowerCase();

  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".eml") return "message/rfc822";
  if (ext === ".msg") return "application/vnd.ms-outlook";
  if (ext === ".csv") return "text/csv; charset=utf-8";

  return "application/octet-stream";
}

function isHiddenSidecar(fileName) {
  return String(fileName || "").endsWith(".meta.json");
}

function filePathFromName(fileName) {
  const dir = inboxDir();
  const safe = safeFileName(decodeURIComponent(String(fileName || "")));
  const filePath = path.join(dir, safe);

  if (!filePath.startsWith(dir)) {
    throw new Error("不正なファイル名です。");
  }

  return filePath;
}

function listInboxItems() {
  const dir = inboxDir();

  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .filter(entry => !isHiddenSidecar(entry.name))
    .map(entry => {
      const filePath = path.join(dir, entry.name);
      const stat = fs.statSync(filePath);
      const meta = readJsonSafe(metaPathFor(filePath)) || {};
      const ocrText = meta.ocrRawText || meta.ocr_raw_text || meta.ocrText || "";

      return {
        fileName: entry.name,
        originalFileName: meta.originalFileName || entry.name,
        documentType: meta.documentType || "",
        destination: meta.destination || "",
        sourceType: meta.sourceType || "",
        vendorName: meta.vendorName || "",
        note: meta.note || "",
        emailSubject: meta.emailSubject || "",
        emailFrom: meta.emailFrom || "",
        mimeType: meta.mimeType || getMimeType(entry.name),
        sizeBytes: stat.size,
        sha256: meta.sha256 || meta.fileSha256 || meta.contentHash || "",
        duplicateOfFileName: meta.duplicateOfFileName || "",
        updatedAt: stat.mtime.toISOString(),
        inboxStatus: meta.inboxStatus || "",
        processStatus: meta.processStatus || "",
        ocrStatus: meta.ocrStatus || (ocrText ? "ocr_done" : "ocr_waiting"),
        ocrProvider: meta.ocrProvider || "",
        ocrAt: meta.ocrAt || "",
        ocrError: meta.ocrError || "",
        ocrRawText: ocrText,
        ocrTextPreview: String(ocrText).slice(0, 240),
        saveStatus: meta.saveStatus || meta.savedStatus || "",
        savedStatus: meta.savedStatus || meta.saveStatus || "",
        evidenceSaved: !!meta.evidenceSaved,
        ocrSaved: !!meta.ocrSaved,
        savedAt: meta.savedAt || "",
        savedByPage: meta.savedByPage || ""
      };
    })
    .filter(item => {
      /* PAYMENT_DOCUMENT_HIDE_SAVED_INBOX_20260707_START */
      const savedStatus = String(item.saveStatus || item.savedStatus || "").toLowerCase();
      const processStatus = String(item.processStatus || "").toLowerCase();

      if (
        savedStatus === "saved" ||
        processStatus === "saved" ||
        (item.evidenceSaved && item.ocrSaved)
      ) {
        return false;
      }

      return true;
      /* PAYMENT_DOCUMENT_HIDE_SAVED_INBOX_20260707_END */
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  return files;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;

    req.on("data", chunk => {
      bytes += chunk.length;

      if (bytes > MAX_UPLOAD_BYTES + 1024 * 1024) {
        reject(new Error("アップロードサイズが大きすぎます。"));
        req.destroy();
        return;
      }

      body += chunk.toString("utf8");
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSONとして読めませんでした。"));
      }
    });

    req.on("error", reject);
  });
}

function parseDataUrl(dataUrl) {
  const text = String(dataUrl || "");
  const match = text.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);

  if (!match) {
    throw new Error("dataUrl形式ではありません。");
  }

  const mimeType = match[1] || "application/octet-stream";
  const isBase64 = !!match[2];
  const payload = match[3] || "";

  const buffer = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");

  return { mimeType, buffer };
}

function getAzureDocumentIntelligenceSettings() {
  const endpoint =
    process.env.HD_ORIGIN_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT ||
    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT ||
    process.env.DOCUMENT_INTELLIGENCE_ENDPOINT ||
    process.env.AZURE_FORM_RECOGNIZER_ENDPOINT ||
    process.env.FORM_RECOGNIZER_ENDPOINT ||
    process.env.AZURE_OCR_ENDPOINT;

  const key =
    process.env.HD_ORIGIN_AZURE_DOCUMENT_INTELLIGENCE_KEY ||
    process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY ||
    process.env.DOCUMENT_INTELLIGENCE_KEY ||
    process.env.AZURE_FORM_RECOGNIZER_KEY ||
    process.env.FORM_RECOGNIZER_KEY ||
    process.env.AZURE_OCR_KEY;

  if (!endpoint || !key) {
    throw new Error(
      "Azure OCR設定が見つかりません。.env の AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT / AZURE_DOCUMENT_INTELLIGENCE_KEY などを確認してください。"
    );
  }

  return {
    endpoint: String(endpoint).replace(/\/+$/, ""),
    key: String(key)
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractAzureText(result) {
  if (result && result.analyzeResult && typeof result.analyzeResult.content === "string") {
    return result.analyzeResult.content;
  }

  const lines = [];

  const pages = result && result.analyzeResult && Array.isArray(result.analyzeResult.pages)
    ? result.analyzeResult.pages
    : [];

  for (const page of pages) {
    if (!Array.isArray(page.lines)) continue;

    for (const line of page.lines) {
      if (line && line.content) {
        lines.push(line.content);
      }
    }
  }

  return lines.join("\n");
}

async function analyzeFileWithAzure(filePath, mimeType) {
  const settings = getAzureDocumentIntelligenceSettings();

  const url =
    settings.endpoint +
    "/documentintelligence/documentModels/prebuilt-read:analyze?api-version=" +
    encodeURIComponent(AZURE_API_VERSION);

  const buffer = fs.readFileSync(filePath);

  const startRes = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": settings.key,
      "Content-Type": mimeType || "application/octet-stream"
    },
    body: buffer
  });

  const startText = await startRes.text();

  if (!startRes.ok && startRes.status !== 202) {
    throw new Error("Azure OCR開始失敗: HTTP " + startRes.status + " " + startText.slice(0, 600));
  }

  const operationLocation =
    startRes.headers.get("operation-location") ||
    startRes.headers.get("Operation-Location");

  if (!operationLocation) {
    try {
      const immediate = JSON.parse(startText);
      const immediateText = extractAzureText(immediate);
      return { rawText: immediateText, rawJson: immediate };
    } catch {
      throw new Error("Azure OCRのOperation-Locationが取得できませんでした。");
    }
  }

  let lastJson = null;

  for (let i = 0; i < 45; i++) {
    await sleep(1000);

    const pollRes = await fetch(operationLocation, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": settings.key
      }
    });

    const pollText = await pollRes.text();

    if (!pollRes.ok) {
      throw new Error("Azure OCR確認失敗: HTTP " + pollRes.status + " " + pollText.slice(0, 600));
    }

    let json;
    try {
      json = JSON.parse(pollText);
    } catch {
      throw new Error("Azure OCR結果をJSONとして読めませんでした。");
    }

    lastJson = json;

    const status = String(json.status || "").toLowerCase();

    if (status === "succeeded") {
      return {
        rawText: extractAzureText(json),
        rawJson: json
      };
    }

    if (status === "failed") {
      throw new Error("Azure OCRが失敗しました: " + JSON.stringify(json.error || json).slice(0, 800));
    }
  }

  throw new Error("Azure OCRがタイムアウトしました。最後の状態: " + JSON.stringify(lastJson || {}).slice(0, 800));
}

async function ocrOneFile(fileName) {
  const filePath = filePathFromName(fileName);

  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      fileName,
      error: "ファイルが見つかりません。"
    };
  }

  const metaPath = metaPathFor(filePath);
  const current = readJsonSafe(metaPath) || {};
  const mimeType = current.mimeType || getMimeType(filePath);

  const ext = path.extname(filePath).toLowerCase();
  const ocrAllowed =
    mimeType.startsWith("image/") ||
    mimeType.includes("pdf") ||
    ext === ".pdf" ||
    ext === ".png" ||
    ext === ".jpg" ||
    ext === ".jpeg" ||
    ext === ".webp";

  if (!ocrAllowed) {
    const next = {
      ...current,
      ocrStatus: "ocr_skipped",
      ocrError: "この形式はOCR対象外です。",
      ocrAt: new Date().toISOString()
    };
    writeJson(metaPath, next);

    return {
      ok: false,
      fileName,
      skipped: true,
      error: "この形式はOCR対象外です。"
    };
  }

  try {
    const analyzed = await analyzeFileWithAzure(filePath, mimeType);

    const rawText = String(analyzed.rawText || "").trim();

    const next = {
      ...current,
      ocrStatus: rawText ? "ocr_done" : "ocr_empty",
      ocrProvider: "azure_document_intelligence_prebuilt_read",
      ocrApiVersion: AZURE_API_VERSION,
      ocrAt: new Date().toISOString(),
      ocrRawText: rawText,
      ocr_raw_text: rawText,
      ocrText: rawText,
      ocrTextLength: rawText.length,
      ocrError: "",
      processStatus: rawText ? "ocr_done" : "ocr_empty"
    };

    writeJson(metaPath, next);

    return {
      ok: true,
      fileName,
      status: next.ocrStatus,
      textLength: rawText.length,
      textPreview: rawText.slice(0, 180)
    };
  } catch (err) {
    const next = {
      ...current,
      ocrStatus: "ocr_error",
      ocrProvider: "azure_document_intelligence_prebuilt_read",
      ocrApiVersion: AZURE_API_VERSION,
      ocrAt: new Date().toISOString(),
      ocrError: err.message || String(err),
      processStatus: "ocr_error"
    };

    writeJson(metaPath, next);

    return {
      ok: false,
      fileName,
      status: "ocr_error",
      error: err.message || String(err)
    };
  }
}

async function saveOneInboxItem(fileName) {
  const filePath = filePathFromName(fileName);

  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      fileName,
      status: "missing",
      error: "ファイルが見つかりません。"
    };
  }

  const metaPath = metaPathFor(filePath);
  const current = readJsonSafe(metaPath) || {};
  const stat = fs.statSync(filePath);
  const ocrText = String(current.ocrRawText || current.ocr_raw_text || current.ocrText || "").trim();

  if (!ocrText) {
    return {
      ok: false,
      fileName,
      status: "no_ocr",
      originalFileName: current.originalFileName || path.basename(filePath),
      error: "OCR本文が未保存のため、保存できません。"
    };
  }

  const now = new Date().toISOString();

  const next = {
    ...current,
    originalFileName: current.originalFileName || path.basename(filePath),
    savedFileName: current.savedFileName || path.basename(filePath),
    mimeType: current.mimeType || getMimeType(filePath),
    sizeBytes: current.sizeBytes || stat.size,

    ocrStatus: current.ocrStatus || "ocr_done",
    ocrRawText: ocrText,
    ocr_raw_text: ocrText,
    ocrText,
    ocrTextLength: ocrText.length,

    processStatus: "saved",
    saveStatus: "saved",
    savedStatus: "saved",
    evidenceSaveStatus: "saved",
    ocrSaveStatus: "saved",
    evidenceSaved: true,
    ocrSaved: true,
    savedAt: now,
    savedByPage: "payment-document-inbox",
    updatedAt: now
  };
  const moved = movePaymentDocumentToSaved(filePath, next);

  return {
    ok: true,
    fileName: moved.fileName,
    originalFileName: moved.originalFileName,
    status: "saved",
    savedAt: moved.savedAt || now,
    textLength: ocrText.length,
    savedRelativePath: moved.savedRelativePath,
    savedMetaRelativePath: moved.savedMetaRelativePath
  };
}
/* PAYMENT_DOCUMENT_DB_OCR_IMPORTS_20260707_START */
function textOrEmpty(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function dateOrNull(value) {
  const text = textOrEmpty(value);
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function documentKeyFromMeta(meta, fallbackFileName) {
  const savedRelativePath = textOrEmpty(meta.savedRelativePath);
  const savedMetaRelativePath = textOrEmpty(meta.savedMetaRelativePath);
  const sha256 = textOrEmpty(meta.sha256 || meta.fileSha256 || meta.contentHash);
  const savedFileName = textOrEmpty(meta.savedFileName || fallbackFileName);

  if (savedRelativePath) return "saved:" + savedRelativePath;
  if (savedMetaRelativePath) return "meta:" + savedMetaRelativePath;
  if (sha256) return "sha256:" + sha256;
  return "file:" + savedFileName;
}

async function upsertPaymentDocumentOcrImport(meta, fallbackFileName) {
  const ocrText = textOrEmpty(meta.ocrRawText || meta.ocr_raw_text || meta.ocrText);

  if (!ocrText) {
    return null;
  }

  const documentKey = documentKeyFromMeta(meta, fallbackFileName);
  const originalFileName = textOrEmpty(meta.originalFileName || fallbackFileName);
  const savedFileName = textOrEmpty(meta.savedFileName || fallbackFileName);
  const sha256 = textOrEmpty(meta.sha256 || meta.fileSha256 || meta.contentHash);

  const result = await db.query(`
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
    RETURNING payment_document_ocr_import_id
  `, [
    documentKey,
    originalFileName,
    savedFileName,
    textOrEmpty(meta.mimeType),
    Number(meta.sizeBytes || 0),
    sha256,
    textOrEmpty(meta.documentType),
    textOrEmpty(meta.destination),
    textOrEmpty(meta.sourceType),
    textOrEmpty(meta.vendorName),
    textOrEmpty(meta.note),
    textOrEmpty(meta.emailSubject),
    textOrEmpty(meta.emailFrom),
    textOrEmpty(meta.emailReceivedAt),
    textOrEmpty(meta.ocrStatus || (ocrText ? "ocr_done" : "")),
    textOrEmpty(meta.ocrProvider),
    textOrEmpty(meta.ocrApiVersion),
    dateOrNull(meta.ocrAt),
    ocrText,
    ocrText.length,
    textOrEmpty(meta.ocrError),
    textOrEmpty(meta.processStatus),
    textOrEmpty(meta.saveStatus || meta.savedStatus),
    !!meta.evidenceSaved,
    !!meta.ocrSaved,
    textOrEmpty(meta.savedRelativePath),
    textOrEmpty(meta.savedMetaRelativePath),
    dateOrNull(meta.savedAt),
    textOrEmpty(meta.savedByPage)
  ]);

  return result.rows[0] || null;
}

async function listPaymentDocumentOcrImportsFromDb() {
  const result = await db.query(`
    SELECT
      payment_document_ocr_import_id,
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
      process_status,
      save_status,
      evidence_saved,
      ocr_saved,
      saved_relative_path,
      saved_meta_relative_path,
      saved_at,
      saved_by_page,
      draft_status,
      created_at,
      updated_at
    FROM accounting.payment_document_ocr_imports
    WHERE deleted_at IS NULL
      AND COALESCE(ocr_raw_text, '') <> ''
    ORDER BY
      saved_at DESC NULLS LAST,
      ocr_at DESC NULLS LAST,
      payment_document_ocr_import_id DESC
    LIMIT 500
  `);

  return result.rows.map(row => ({
    source: "database",
    paymentDocumentOcrImportId: row.payment_document_ocr_import_id,
    imageUrl: "/api/payment-documents/ocr-imports/file/" + encodeURIComponent(String(row.payment_document_ocr_import_id)),
    fileName: row.saved_file_name || row.original_file_name,
    originalFileName: row.original_file_name || row.saved_file_name,
    savedFileName: row.saved_file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    documentType: row.document_type,
    destination: row.destination,
    sourceType: row.source_type,
    vendorName: row.vendor_name,
    note: row.note,
    emailSubject: row.email_subject,
    emailFrom: row.email_from,
    emailReceivedAt: row.email_received_at,
    ocrStatus: row.ocr_status || "ocr_done",
    ocrProvider: row.ocr_provider,
    ocrApiVersion: row.ocr_api_version,
    ocrAt: row.ocr_at,
    ocrRawText: row.ocr_raw_text,
    ocrTextPreview: String(row.ocr_raw_text || "").slice(0, 240),
    ocrTextLength: row.ocr_text_length,
    processStatus: row.process_status,
    saveStatus: row.save_status,
    savedStatus: row.save_status,
    evidenceSaved: row.evidence_saved,
    ocrSaved: row.ocr_saved,
    savedRelativePath: row.saved_relative_path,
    savedMetaRelativePath: row.saved_meta_relative_path,
    savedAt: row.saved_at,
    savedByPage: row.saved_by_page,
    draftStatus: row.draft_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}
/* PAYMENT_DOCUMENT_DB_OCR_IMPORTS_20260707_END */
async function handlePaymentDocumentRoutes(req, res) {
  const urlObj = new URL(req.url, "http://localhost");
  const urlPath = urlObj.pathname;

  if (req.method === "GET" && urlPath.startsWith("/api/payment-documents/ocr-imports/file/")) {
    try {
      const idText = decodeURIComponent(urlPath.replace("/api/payment-documents/ocr-imports/file/", ""));
      const id = Number(idText);

      if (!Number.isInteger(id) || id < 1) {
        sendJson(res, 400, { ok: false, error: "不正なOCR取込IDです。" });
        return true;
      }

      const result = await db.query(`
        SELECT
          payment_document_ocr_import_id,
          saved_relative_path,
          saved_meta_relative_path,
          saved_file_name,
          original_file_name,
          mime_type,
          source_type
        FROM accounting.payment_document_ocr_imports
        WHERE payment_document_ocr_import_id = $1
          AND deleted_at IS NULL
        LIMIT 1
      `, [id]);

      if (!result.rows.length) {
        sendJson(res, 404, { ok: false, error: "OCR取込データが見つかりません。" });
        return true;
      }

      const row = result.rows[0];
      const filePath = paymentDocumentFilePathFromOcrImportRow(row);

      if (!filePath || !fs.existsSync(filePath)) {
        sendJson(res, 404, {
          ok: false,
          error: "原本ファイルが見つかりません。",
          id
        });
        return true;
      }

      const mimeType = row.mime_type || getMimeType(filePath);

      res.writeHead(200, {
        "Content-Type": mimeType,
        "Cache-Control": "no-store"
      });

      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err.message || String(err) });
    }

    return true;
  }
  if (req.method === "GET" && urlPath === "/api/payment-documents/ocr-imports") {
    try {
      const items = await listPaymentDocumentOcrImportsFromDb();

      sendJson(res, 200, {
        ok: true,
        source: "database",
        count: items.length,
        items
      });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        source: "database",
        error: err.message || String(err)
      });
    }

    return true;
  }
  if (req.method === "GET" && urlPath === "/api/payment-documents/scan-inbox") {
    const items = listInboxItems();

    sendJson(res, 200, {
      ok: true,
      dir: inboxDir(),
      count: items.length,
      normalLimit: 100,
      hardLimit: 500,
      items
    });
    return true;
  }

  if (req.method === "GET" && urlPath.startsWith("/api/payment-documents/scan-inbox/file/")) {
    try {
      const name = urlPath.replace("/api/payment-documents/scan-inbox/file/", "");
      const filePath = filePathFromName(name);

      if (!fs.existsSync(filePath)) {
        sendJson(res, 404, { ok: false, error: "ファイルが見つかりません。" });
        return true;
      }

      const mimeType = getMimeType(filePath);

      res.writeHead(200, {
        "Content-Type": mimeType,
        "Cache-Control": "no-store"
      });

      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message });
    }

    return true;
  }

  if (req.method === "POST" && urlPath === "/api/payment-documents/scan-inbox/upload") {
    try {
      const body = await readBody(req);
      const originalFileName = String(body.fileName || "payment-document").trim();
      const safeOriginal = safeFileName(originalFileName);
      const parsed = parseDataUrl(body.dataUrl);

      if (parsed.buffer.length > MAX_UPLOAD_BYTES) {
        sendJson(res, 413, {
          ok: false,
          error: "ファイルサイズが大きすぎます。",
          maxBytes: MAX_UPLOAD_BYTES
        });
        return true;
      }

      const fileHash = sha256Buffer(parsed.buffer);
      const duplicateItem = findDuplicateInboxItem(fileHash, parsed.buffer.length);

      if (duplicateItem) {
        sendJson(res, 200, {
          ok: true,
          duplicate: true,
          skipped: true,
          message: "同じ内容の支払書類が既にINBOXにあるため、追加しませんでした。",
          item: duplicateItem,
          duplicateItem
        });
        return true;
      }

      const saveName = timestampPrefix() + "_" + safeOriginal;
      const filePath = path.join(inboxDir(), saveName);

      fs.writeFileSync(filePath, parsed.buffer);

      writeJson(metaPathFor(filePath), {
        originalFileName,
        savedFileName: saveName,
        mimeType: body.mimeType || parsed.mimeType,
        sizeBytes: parsed.buffer.length,
        sha256: fileHash,
        fileSha256: fileHash,
        documentType: body.documentType || "",
        destination: body.destination || "",
        sourceType: body.sourceType || "",
        vendorName: body.vendorName || "",
        note: body.note || "",
        ocrStatus: "ocr_waiting",
        processStatus: "inbox",
        uploadedAt: new Date().toISOString()
      });

      sendJson(res, 200, {
        ok: true,
        duplicate: false,
        message: "支払書類をINBOXへ追加しました。",
        item: {
          fileName: saveName,
          originalFileName,
          mimeType: body.mimeType || parsed.mimeType,
          sizeBytes: parsed.buffer.length
        }
      });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message });
    }

    return true;
  }

  if (req.method === "POST" && urlPath === "/api/payment-documents/scan-inbox/delete") {
    try {
      const body = await readBody(req);
      const filePath = filePathFromName(body.fileName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      const metaPath = metaPathFor(filePath);
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }

      sendJson(res, 200, {
        ok: true,
        message: "削除しました。"
      });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message });
    }

    return true;
  }

  if (req.method === "POST" && urlPath === "/api/payment-documents/scan-inbox/update-meta") {
    try {
      const body = await readBody(req);
      const filePath = filePathFromName(body.fileName);

      if (!fs.existsSync(filePath)) {
        sendJson(res, 404, { ok: false, error: "ファイルが見つかりません。" });
        return true;
      }

      const current = readJsonSafe(metaPathFor(filePath)) || {};

      const next = {
        ...current,
        documentType: body.documentType || "",
        destination: body.destination || "",
        sourceType: body.sourceType || "",
        vendorName: body.vendorName || "",
        note: body.note || "",
        emailSubject: body.emailSubject || "",
        emailFrom: body.emailFrom || "",
        emailReceivedAt: body.emailReceivedAt || "",
        inboxStatus: body.documentType || body.destination || body.vendorName ? "classified" : "unclassified",
        updatedAt: new Date().toISOString()
      };

      writeJson(metaPathFor(filePath), next);

      sendJson(res, 200, {
        ok: true,
        message: "仮分類を保存しました。",
        meta: next
      });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message });
    }

    return true;
  }

  if (req.method === "POST" && urlPath === "/api/payment-documents/scan-inbox/save-selected") {
    try {
      const body = await readBody(req);
      const fileNames = Array.isArray(body.fileNames) ? body.fileNames : [];

      if (fileNames.length < 1) {
        sendJson(res, 400, {
          ok: false,
          error: "保存対象が選択されていません。"
        });
        return true;
      }

      const results = [];

      for (const fileName of fileNames) {
        try {
          results.push(await saveOneInboxItem(fileName));
        } catch (err) {
          results.push({
            ok: false,
            fileName,
            status: "error",
            error: err.message || String(err)
          });
        }
      }

      const successCount = results.filter(x => x.ok).length;
      const failedCount = results.length - successCount;

      sendJson(res, 200, {
        ok: failedCount === 0,
        message: "チェック分を保存しました。",
        targetCount: fileNames.length,
        successCount,
        failedCount,
        results
      });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: err.message || String(err)
      });
    }

    return true;
  }
  if (req.method === "POST" && urlPath === "/api/payment-documents/scan-inbox/ocr-selected") {
    try {
      const body = await readBody(req);
      const fileNames = Array.isArray(body.fileNames) ? body.fileNames : [];

      if (fileNames.length < 1) {
        sendJson(res, 400, {
          ok: false,
          error: "OCR対象が選択されていません。"
        });
        return true;
      }

      const results = [];

      for (const fileName of fileNames) {
        results.push(await ocrOneFile(fileName));
      }

      const successCount = results.filter(x => x.ok).length;
      const failedCount = results.length - successCount;

      sendJson(res, 200, {
        ok: failedCount === 0,
        message: "まとめてOCRを実行しました。",
        targetCount: fileNames.length,
        successCount,
        failedCount,
        results
      });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: err.message || String(err)
      });
    }

    return true;
  }

  return false;
}


module.exports = {
  handlePaymentDocumentRoutes
};