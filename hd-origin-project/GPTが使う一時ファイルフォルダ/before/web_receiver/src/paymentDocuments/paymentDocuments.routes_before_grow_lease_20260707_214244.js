const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");
const { sendJson } = require("../response");
const db = require("../db");
const { loadPaymentDocumentPromptText, appendPaymentDocumentExternalPrompt, selectPaymentDocumentPromptFiles } = require("./paymentDocuments.aiPromptLoader");
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
/* PAYMENT_DOCUMENT_OPENAI_OCR_DRAFT_20260707_START */
function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || "";
}

function getOpenAiModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function safeJsonParse(text) {
  try {
    return JSON.parse(String(text || ""));
  } catch {
    return null;
  }
}


/* PAYMENT_DOCUMENT_AI_CODE_NORMALIZE_20260707_START */
function normalizePaymentDocumentAiCodeText(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[　]/g, "")
    .replace(/[・･]/g, "")
    .replace(/[／\/]/g, "")
    .replace(/[（）()]/g, "")
    .replace(/[：:]/g, "")
    .trim()
    .toLowerCase();
}

function normalizePaymentDocumentTypeCodeFromText(value) {
  const raw = String(value || "").trim();
  const norm = normalizePaymentDocumentAiCodeText(raw);

  if (!raw) return "";

  const codes = [
    "invoice",
    "receipt",
    "tax_payment_notice",
    "card_statement",
    "utility_notice",
    "insurance_notice",
    "lease_contract",
    "contract",
    "web_statement",
    "mail_saved",
    "other"
  ];

  if (codes.includes(raw)) return raw;

  if (norm.includes("リース")) return "lease_contract";
  if (norm.includes("納付") || norm.includes("納税") || norm.includes("税金") || norm.includes("税務署")) return "tax_payment_notice";
  if (norm.includes("カード")) return "card_statement";
  if (norm.includes("公共") || norm.includes("電気") || norm.includes("ガス") || norm.includes("水道")) return "utility_notice";
  if (norm.includes("保険")) return "insurance_notice";
  if (norm.includes("請求")) return "invoice";
  if (norm.includes("領収")) return "receipt";
  if (norm.includes("契約")) return "contract";
  if (norm.includes("メール")) return "mail_saved";
  if (norm.includes("web") || norm.includes("ウェブ")) return "web_statement";
  if (norm.includes("その他")) return "other";

  return "";
}

function normalizePaymentDestinationCodeFromText(value) {
  const raw = String(value || "").trim();
  const norm = normalizePaymentDocumentAiCodeText(raw);

  if (!raw) return "";

  const codes = [
    "payable",
    "accounts_payable",
    "expense",
    "tax_public",
    "card_payable",
    "contract_insurance_lease",
    "no_process",
    "needs_review"
  ];

  if (codes.includes(raw)) return raw;

  if (norm.includes("税") || norm.includes("公的") || norm.includes("納付")) return "tax_public";
  if (norm.includes("リース") || norm.includes("保険") || norm.includes("契約")) return "contract_insurance_lease";
  if (norm.includes("カード")) return "card_payable";
  if (norm.includes("買掛") || norm.includes("仕入債務")) return "accounts_payable";
  if (norm.includes("経費")) return "expense";
  if (norm.includes("支払")) return "payable";
  if (norm.includes("対象外")) return "no_process";
  if (norm.includes("確認")) return "needs_review";

  return "";
}
/* PAYMENT_DOCUMENT_AI_CODE_NORMALIZE_20260707_END */
function normalizeAiDraftCandidate(value) {
  const draft = value && typeof value === "object" ? value : {};

  return {
    document_type_code: String(draft.document_type_code || "").trim(),
    payment_destination_code: String(draft.payment_destination_code || "").trim(),
    accounting_category_code: String(draft.accounting_category_code || "").trim(),
    payable_kind_code: String(draft.payable_kind_code || "").trim(),
    source_type_code: String(draft.source_type_code || "").trim(),

    vendor_name: String(draft.vendor_name || "").trim(),
    issue_date: String(draft.issue_date || "").trim(),
    due_date: String(draft.due_date || "").trim(),
    invoice_number: String(draft.invoice_number || "").trim(),

    total_amount: draft.total_amount === null || draft.total_amount === undefined || draft.total_amount === ""
      ? null
      : Number(draft.total_amount),

    tax_amount: draft.tax_amount === null || draft.tax_amount === undefined || draft.tax_amount === ""
      ? null
      : Number(draft.tax_amount),

    currency: String(draft.currency || "JPY").trim(),
    summary: String(draft.summary || "").trim(),
    memo: String(draft.memo || "").trim(),

    confidence: {
      document_type: Number(draft.confidence && draft.confidence.document_type || 0),
      payment_destination: Number(draft.confidence && draft.confidence.payment_destination || 0),
      vendor_name: Number(draft.confidence && draft.confidence.vendor_name || 0),
      total_amount: Number(draft.confidence && draft.confidence.total_amount || 0)
    },

    warnings: Array.isArray(draft.warnings)
      ? draft.warnings.map(item => String(item || "").trim()).filter(Boolean)
      : []
  };
}


/* PAYMENT_DOCUMENT_TAX_PAYMENT_RULE_FALLBACK_20260707_START */
function paymentDocumentTextValue(value) {
  return String(value || "").trim();
}

function paymentDocumentNormalizeMoneyText(value) {
  const text = String(value || "")
    .replace(/[￥¥円,\s，]/g, "")
    .trim();

  return text || "";
}

function paymentDocumentJpDateToIso(value) {
  const text = String(value || "").trim();

  const match = text.match(/([0-9０-９]{4})\s*年\s*([0-9０-９]{1,2})\s*月\s*([0-9０-９]{1,2})\s*日/);

  if (!match) {
    return text;
  }

  const toHalf = v => String(v || "").replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));

  const y = toHalf(match[1]);
  const m = toHalf(match[2]).padStart(2, "0");
  const d = toHalf(match[3]).padStart(2, "0");

  return y + "-" + m + "-" + d;
}

function paymentDocumentMatchText(text, regex) {
  const match = String(text || "").match(regex);
  return match && match[1] ? String(match[1]).trim() : "";
}

function paymentDocumentSetField(fields, label, value, force) {
  const v = paymentDocumentTextValue(value);

  if (!v) {
    return;
  }

  if (force || !paymentDocumentTextValue(fields[label])) {
    fields[label] = v;
  }
}

function applyPaymentDocumentRuleFallbackFromOcr(ocrText, draft) {
  const text = String(ocrText || "");
  const compact = text.replace(/\s+/g, "");

  const base = draft && typeof draft === "object" ? { ...draft } : {};
  base.fields = base.fields && typeof base.fields === "object" ? { ...base.fields } : {};
  base.ai_summary = base.ai_summary && typeof base.ai_summary === "object" ? { ...base.ai_summary } : {};
  base.warnings = Array.isArray(base.warnings) ? [...base.warnings] : [];

  const looksTaxPayment =
    /納付書|納税通知書|納付先|税目|税務署|法人税|消費税|固定資産税|都市計画税|源泉所得税|市税|府税|県税|附帯税|本税|本稅|合計納付額|納付期限/.test(text) ||
    /納付先[:：].*税目[:：]/.test(compact);

  if (!looksTaxPayment) {
    return base;
  }

  const taxOffice = paymentDocumentMatchText(text, /納付先[:：]\s*([^\r\n]+?)(?:\s+税目[:：]|$)/);
  const taxName = paymentDocumentMatchText(text, /税目[:：]\s*([^\s\r\n]+)/);
  const payer = paymentDocumentMatchText(text, /納付者[:：]\s*([^\r\n]+)/);
  const dueDateRaw = paymentDocumentMatchText(text, /納付期限[:：]\s*([0-9０-９]{4}\s*年\s*[0-9０-９]{1,2}\s*月\s*[0-9０-９]{1,2}\s*日)/);
  const managementNo = paymentDocumentMatchText(text, /整理番号[:：]\s*([^\s\r\n]+)/);
  const baseTax = paymentDocumentNormalizeMoneyText(paymentDocumentMatchText(text, /本[税稅][:：]\s*([0-9０-９,，]+)\s*円?/));
  const additionalTax = paymentDocumentNormalizeMoneyText(paymentDocumentMatchText(text, /附帯税[:：]\s*([0-9０-９,，]+)\s*円?/));
  const totalAmount = paymentDocumentNormalizeMoneyText(paymentDocumentMatchText(text, /合計納付額[:：]\s*([0-9０-９,，]+)\s*円?/));
  const dueDate = paymentDocumentJpDateToIso(dueDateRaw);

  base.document_type_code = "tax_payment_notice";
  base.payment_destination_code = "tax_public";
  base.accounting_category_code = "tax";
  base.payable_kind_code = "unpaid";

  if (!base.source_type_code) {
    base.source_type_code = "scan_upload";
  }

  if (totalAmount) {
    base.total_amount = Number(totalAmount);
  }

  if (dueDate) {
    base.due_date = dueDate;
  }

  if (managementNo && !base.invoice_number) {
    base.invoice_number = managementNo;
  }

  if (taxOffice && !base.vendor_name) {
    base.vendor_name = taxOffice;
  }

  if (!base.summary) {
    base.summary = taxName ? taxName + " 納付" : "税金・公的支払い 納付";
  }

  paymentDocumentSetField(base.fields, "書類種別", "tax_payment_notice", true);
  paymentDocumentSetField(base.fields, "書類区分", "tax_payment_notice", true);
  paymentDocumentSetField(base.fields, "証憑区分", "納付書・納税通知書", false);
  paymentDocumentSetField(base.fields, "処理先", "tax_public", true);
  paymentDocumentSetField(base.fields, "税金・公的支払", "税金・公的支払い", true);
  paymentDocumentSetField(base.fields, "支払対象", "支払対象", true);
  paymentDocumentSetField(base.fields, "未払登録対象", "未払登録対象", true);
  paymentDocumentSetField(base.fields, "経費登録対象", "対象外", true);
  paymentDocumentSetField(base.fields, "発行元", taxOffice, false);
  paymentDocumentSetField(base.fields, "支払先", taxOffice, false);
  paymentDocumentSetField(base.fields, "納付先", taxOffice, false);
  paymentDocumentSetField(base.fields, "税目", taxName, false);
  paymentDocumentSetField(base.fields, "宛名", payer, false);
  paymentDocumentSetField(base.fields, "会社名", payer, false);
  paymentDocumentSetField(base.fields, "支払期限・納期限", dueDate, false);
  paymentDocumentSetField(base.fields, "管理番号", managementNo, false);
  paymentDocumentSetField(base.fields, "通知書番号", managementNo, false);
  paymentDocumentSetField(base.fields, "請求・支払金額", totalAmount, false);
  paymentDocumentSetField(base.fields, "合計金額", totalAmount, false);
  paymentDocumentSetField(base.fields, "税込金額", totalAmount, false);
  paymentDocumentSetField(base.fields, "未払残高", totalAmount, false);
  paymentDocumentSetField(base.fields, "会計区分", "tax", true);
  paymentDocumentSetField(base.fields, "未払種別", "unpaid", true);
  paymentDocumentSetField(base.fields, "勘定科目", taxName || "租税公課", false);
  paymentDocumentSetField(base.fields, "目的", taxName ? taxName + "納付" : "税金・公的支払い納付", false);
  paymentDocumentSetField(base.fields, "摘要", taxName ? taxName + " 納付" : "税金・公的支払い 納付", false);
  paymentDocumentSetField(base.fields, "未払登録", "true", true);
  paymentDocumentSetField(base.fields, "買掛登録", "false", true);

  const lineParts = [];
  if (taxName && baseTax) lineParts.push(taxName + " " + baseTax + "円");
  if (additionalTax) lineParts.push("附帯税 " + additionalTax + "円");
  if (totalAmount) lineParts.push("合計 " + totalAmount + "円");
  paymentDocumentSetField(base.fields, "明細候補", lineParts.join("、"), false);

  base.ai_summary.document_kind = "tax_payment_notice";
  base.ai_summary.destination = "tax_public";
  base.ai_summary.payment_target = "支払対象";
  base.ai_summary.payable_target = "未払登録対象";
  base.ai_summary.expense_target = "対象外";
  base.ai_summary.tax_public = "税金・公的支払い";
  base.ai_summary.contract_insurance_lease = "対象外";
  base.ai_summary.confidence_label = "高";
  base.ai_summary.reason = "OCR本文に納付書、納付先、税目、納付期限、合計納付額などがあるため、納付書・税金公的支払いとして補正しました。";

  if (!base.warnings.some(item => String(item).includes("納付書ルール補正"))) {
    base.warnings.push("納付書ルール補正: OCR本文から納付書・税金公的支払いと判断しました。");
  }

  return base;
}
/* PAYMENT_DOCUMENT_TAX_PAYMENT_RULE_FALLBACK_20260707_END */
function buildPaymentDocumentAiPrompt(ocrText) {
  return [
    "あなたは日本の中小企業向け会計入力補助AIです。",
    "画像は見ていません。OCR本文だけを根拠に、支払書類の下書き候補をJSONで作成してください。",
    "確定ではなく候補です。迷う場合は空文字またはnullにし、warningsに理由を書いてください。",
    "",
    "重要ルール:",
    "- 画像を見た前提の判断は禁止。",
    "- OCR本文にない情報を作らない。",
    "- 金額は数値だけにする。円記号やカンマは入れない。",
    "- 日付は分かる場合だけ YYYY-MM-DD。",
    "- 書類区分などのコードは、下の候補から近いものだけ使う。分からなければ空文字。",
    "",
    "document_type_code候補:",
    "invoice, tax_payment_notice, receipt, web_statement, card_statement, utility_notice, insurance_notice, lease_contract, mail_saved, contract, other",
    "",
    "payment_destination_code候補:",
    "payable, accounts_payable, expense, tax_public, card_payable, contract_insurance_lease, no_process, needs_review",
    "",
    "accounting_category_code候補:",
    "normal, advance_payment, tax, public_utility, insurance, lease, asset, mixed_personal, needs_review",
    "",
    "payable_kind_code候補:",
    "accounts_payable, unpaid, accrued_expense, card_payable, other",
    "",
    "source_type_code候補:",
    "scan_upload, pdf_upload, mail_saved, web_download, manual_upload, other",
    "",
    "返すJSON形式:",
    "{",
    '  "document_type_code": "",',
    '  "payment_destination_code": "",',
    '  "accounting_category_code": "",',
    '  "payable_kind_code": "",',
    '  "source_type_code": "",',
    '  "vendor_name": "",',
    '  "issue_date": "",',
    '  "due_date": "",',
    '  "invoice_number": "",',
    '  "total_amount": null,',
    '  "tax_amount": null,',
    '  "currency": "JPY",',
    '  "summary": "",',
    '  "memo": "",',
    '  "confidence": {',
    '    "document_type": 0,',
    '    "payment_destination": 0,',
    '    "vendor_name": 0,',
    '    "total_amount": 0',
    "  },",
    '  "warnings": []',
    "}",
    "",
    "OCR本文:",
    "------------------------------",
    String(ocrText || "").slice(0, 12000),
    "------------------------------"
  ].join("\n");
}

async function createAiDraftFromOcrText(ocrText) {
  const apiKey = getOpenAiApiKey();

  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY が未設定です。");
    error.statusCode = 500;
    throw error;
  }

  const prompt = buildPaymentDocumentAiPrompt(ocrText);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      temperature: 0,
      messages: [
        {
          role: "system",
          content: loadPaymentDocumentPromptText("legacy.system.txt", "OCR本文だけを根拠に、日本の支払書類の会計入力候補JSONを作成してください。推測しすぎず、必ずJSONのみを返してください。")
        },
        {
          role: "user",
          content: appendPaymentDocumentExternalPrompt(appendPaymentDocumentMasterCodeInstruction(prompt), ["business-rules.txt", "legacy.extra-rules.txt"])
        }
      ],
      response_format: {
        type: "json_object"
      }
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && data.error && data.error.message
        ? data.error.message
        : "OpenAI API error: " + response.status;

    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const content =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
      ? data.choices[0].message.content
      : "";

  const parsed = safeJsonParse(content);

  if (!parsed) {
    const error = new Error("OpenAI応答をJSONとして解析できませんでした。");
    error.statusCode = 500;
    throw error;
  }

  const normalized = normalizeAiDraftCandidate(parsed);
  return applyPaymentDocumentRuleFallbackFromOcr(ocrText, normalized);
}
/* PAYMENT_DOCUMENT_OPENAI_OCR_DRAFT_20260707_END */
/* PAYMENT_DOCUMENT_OPENAI_WIDE_DRAFT_20260707_START */
function normalizeAiValueText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeAiAmountValue(value) {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value).replace(/[￥¥,\s]/g, "").trim();
  if (!text) return "";
  return text;
}


/* PAYMENT_DOCUMENT_AI_CODE_NORMALIZE_20260707_START */
function normalizePaymentDocumentAiCodeText(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[　]/g, "")
    .replace(/[・･]/g, "")
    .replace(/[／\/]/g, "")
    .replace(/[（）()]/g, "")
    .replace(/[：:]/g, "")
    .trim()
    .toLowerCase();
}

function normalizePaymentDocumentTypeCodeFromText(value) {
  const raw = String(value || "").trim();
  const norm = normalizePaymentDocumentAiCodeText(raw);

  if (!raw) return "";

  const codes = [
    "invoice",
    "receipt",
    "tax_payment_notice",
    "card_statement",
    "utility_notice",
    "insurance_notice",
    "lease_contract",
    "contract",
    "web_statement",
    "mail_saved",
    "other"
  ];

  if (codes.includes(raw)) return raw;

  if (norm.includes("リース")) return "lease_contract";
  if (norm.includes("納付") || norm.includes("納税") || norm.includes("税金") || norm.includes("税務署")) return "tax_payment_notice";
  if (norm.includes("カード")) return "card_statement";
  if (norm.includes("公共") || norm.includes("電気") || norm.includes("ガス") || norm.includes("水道")) return "utility_notice";
  if (norm.includes("保険")) return "insurance_notice";
  if (norm.includes("請求")) return "invoice";
  if (norm.includes("領収")) return "receipt";
  if (norm.includes("契約")) return "contract";
  if (norm.includes("メール")) return "mail_saved";
  if (norm.includes("web") || norm.includes("ウェブ")) return "web_statement";
  if (norm.includes("その他")) return "other";

  return "";
}

function normalizePaymentDestinationCodeFromText(value) {
  const raw = String(value || "").trim();
  const norm = normalizePaymentDocumentAiCodeText(raw);

  if (!raw) return "";

  const codes = [
    "payable",
    "accounts_payable",
    "expense",
    "tax_public",
    "card_payable",
    "contract_insurance_lease",
    "no_process",
    "needs_review"
  ];

  if (codes.includes(raw)) return raw;

  if (norm.includes("税") || norm.includes("公的") || norm.includes("納付")) return "tax_public";
  if (norm.includes("リース") || norm.includes("保険") || norm.includes("契約")) return "contract_insurance_lease";
  if (norm.includes("カード")) return "card_payable";
  if (norm.includes("買掛") || norm.includes("仕入債務")) return "accounts_payable";
  if (norm.includes("経費")) return "expense";
  if (norm.includes("支払")) return "payable";
  if (norm.includes("対象外")) return "no_process";
  if (norm.includes("確認")) return "needs_review";

  return "";
}
/* PAYMENT_DOCUMENT_AI_CODE_NORMALIZE_20260707_END */
function normalizeAiDraftCandidate(value) {
  const draft = value && typeof value === "object" ? value : {};
  const fields = draft.fields && typeof draft.fields === "object" ? draft.fields : {};

  return {
    document_type_code: normalizeAiValueText(draft.document_type_code || normalizePaymentDocumentTypeCodeFromText(fields["書類種別"] || fields["書類区分"] || (draft.ai_summary && draft.ai_summary.document_kind))),
    payment_destination_code: normalizeAiValueText(draft.payment_destination_code || normalizePaymentDestinationCodeFromText(fields["処理先"] || (draft.ai_summary && draft.ai_summary.destination))),
    accounting_category_code: normalizeAiValueText(draft.accounting_category_code),
    payable_kind_code: normalizeAiValueText(draft.payable_kind_code),
    source_type_code: normalizeAiValueText(draft.source_type_code),

    vendor_name: normalizeAiValueText(draft.vendor_name || fields["支払先"] || fields["発行元"]),
    issue_date: normalizeAiValueText(draft.issue_date || fields["発行日"] || fields["書類日付"] || fields["請求日"]),
    due_date: normalizeAiValueText(draft.due_date || fields["支払期限・納期限"]),
    invoice_number: normalizeAiValueText(draft.invoice_number || fields["請求書番号"]),
    total_amount: draft.total_amount === null || draft.total_amount === undefined || draft.total_amount === ""
      ? null
      : Number(String(draft.total_amount).replace(/[￥¥,\s]/g, "")),
    tax_amount: draft.tax_amount === null || draft.tax_amount === undefined || draft.tax_amount === ""
      ? null
      : Number(String(draft.tax_amount).replace(/[￥¥,\s]/g, "")),
    currency: normalizeAiValueText(draft.currency || "JPY"),
    summary: normalizeAiValueText(draft.summary || fields["摘要"]),
    memo: normalizeAiValueText(draft.memo || fields["社内メモ"]),

    ai_summary: {
      document_kind: normalizeAiValueText(draft.ai_summary && draft.ai_summary.document_kind || fields["書類区分"] || fields["書類種別"] || draft.document_type_code || ""),
      destination: normalizeAiValueText(draft.ai_summary && draft.ai_summary.destination || ""),
      payment_target: normalizeAiValueText(draft.ai_summary && draft.ai_summary.payment_target || ""),
      payable_target: normalizeAiValueText(draft.ai_summary && draft.ai_summary.payable_target || ""),
      expense_target: normalizeAiValueText(draft.ai_summary && draft.ai_summary.expense_target || ""),
      tax_public: normalizeAiValueText(draft.ai_summary && draft.ai_summary.tax_public || ""),
      contract_insurance_lease: normalizeAiValueText(draft.ai_summary && draft.ai_summary.contract_insurance_lease || ""),
      confidence_label: normalizeAiValueText(draft.ai_summary && draft.ai_summary.confidence_label || ""),
      reason: normalizeAiValueText(draft.ai_summary && draft.ai_summary.reason || "")
    },

    fields: fields,

    confidence: {
      document_type: Number(draft.confidence && draft.confidence.document_type || 0),
      payment_destination: Number(draft.confidence && draft.confidence.payment_destination || 0),
      vendor_name: Number(draft.confidence && draft.confidence.vendor_name || 0),
      total_amount: Number(draft.confidence && draft.confidence.total_amount || 0)
    },

    warnings: Array.isArray(draft.warnings)
      ? draft.warnings.map(item => String(item || "").trim()).filter(Boolean)
      : []
  };
}


/* PAYMENT_DOCUMENT_TAX_PAYMENT_RULE_FALLBACK_20260707_START */
function paymentDocumentTextValue(value) {
  return String(value || "").trim();
}

function paymentDocumentNormalizeMoneyText(value) {
  const text = String(value || "")
    .replace(/[￥¥円,\s，]/g, "")
    .trim();

  return text || "";
}

function paymentDocumentJpDateToIso(value) {
  const text = String(value || "").trim();

  const match = text.match(/([0-9０-９]{4})\s*年\s*([0-9０-９]{1,2})\s*月\s*([0-9０-９]{1,2})\s*日/);

  if (!match) {
    return text;
  }

  const toHalf = v => String(v || "").replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));

  const y = toHalf(match[1]);
  const m = toHalf(match[2]).padStart(2, "0");
  const d = toHalf(match[3]).padStart(2, "0");

  return y + "-" + m + "-" + d;
}

function paymentDocumentMatchText(text, regex) {
  const match = String(text || "").match(regex);
  return match && match[1] ? String(match[1]).trim() : "";
}

function paymentDocumentSetField(fields, label, value, force) {
  const v = paymentDocumentTextValue(value);

  if (!v) {
    return;
  }

  if (force || !paymentDocumentTextValue(fields[label])) {
    fields[label] = v;
  }
}

function applyPaymentDocumentRuleFallbackFromOcr(ocrText, draft) {
  const text = String(ocrText || "");
  const compact = text.replace(/\s+/g, "");

  const base = draft && typeof draft === "object" ? { ...draft } : {};
  base.fields = base.fields && typeof base.fields === "object" ? { ...base.fields } : {};
  base.ai_summary = base.ai_summary && typeof base.ai_summary === "object" ? { ...base.ai_summary } : {};
  base.warnings = Array.isArray(base.warnings) ? [...base.warnings] : [];

  const looksTaxPayment =
    /納付書|納税通知書|納付先|税目|税務署|法人税|消費税|固定資産税|都市計画税|源泉所得税|市税|府税|県税|附帯税|本税|本稅|合計納付額|納付期限/.test(text) ||
    /納付先[:：].*税目[:：]/.test(compact);

  if (!looksTaxPayment) {
    return base;
  }

  const taxOffice = paymentDocumentMatchText(text, /納付先[:：]\s*([^\r\n]+?)(?:\s+税目[:：]|$)/);
  const taxName = paymentDocumentMatchText(text, /税目[:：]\s*([^\s\r\n]+)/);
  const payer = paymentDocumentMatchText(text, /納付者[:：]\s*([^\r\n]+)/);
  const dueDateRaw = paymentDocumentMatchText(text, /納付期限[:：]\s*([0-9０-９]{4}\s*年\s*[0-9０-９]{1,2}\s*月\s*[0-9０-９]{1,2}\s*日)/);
  const managementNo = paymentDocumentMatchText(text, /整理番号[:：]\s*([^\s\r\n]+)/);
  const baseTax = paymentDocumentNormalizeMoneyText(paymentDocumentMatchText(text, /本[税稅][:：]\s*([0-9０-９,，]+)\s*円?/));
  const additionalTax = paymentDocumentNormalizeMoneyText(paymentDocumentMatchText(text, /附帯税[:：]\s*([0-9０-９,，]+)\s*円?/));
  const totalAmount = paymentDocumentNormalizeMoneyText(paymentDocumentMatchText(text, /合計納付額[:：]\s*([0-9０-９,，]+)\s*円?/));
  const dueDate = paymentDocumentJpDateToIso(dueDateRaw);

  base.document_type_code = "tax_payment_notice";
  base.payment_destination_code = "tax_public";
  base.accounting_category_code = "tax";
  base.payable_kind_code = "unpaid";

  if (!base.source_type_code) {
    base.source_type_code = "scan_upload";
  }

  if (totalAmount) {
    base.total_amount = Number(totalAmount);
  }

  if (dueDate) {
    base.due_date = dueDate;
  }

  if (managementNo && !base.invoice_number) {
    base.invoice_number = managementNo;
  }

  if (taxOffice && !base.vendor_name) {
    base.vendor_name = taxOffice;
  }

  if (!base.summary) {
    base.summary = taxName ? taxName + " 納付" : "税金・公的支払い 納付";
  }

  paymentDocumentSetField(base.fields, "書類種別", "tax_payment_notice", true);
  paymentDocumentSetField(base.fields, "書類区分", "tax_payment_notice", true);
  paymentDocumentSetField(base.fields, "証憑区分", "納付書・納税通知書", false);
  paymentDocumentSetField(base.fields, "処理先", "tax_public", true);
  paymentDocumentSetField(base.fields, "税金・公的支払", "税金・公的支払い", true);
  paymentDocumentSetField(base.fields, "支払対象", "支払対象", true);
  paymentDocumentSetField(base.fields, "未払登録対象", "未払登録対象", true);
  paymentDocumentSetField(base.fields, "経費登録対象", "対象外", true);
  paymentDocumentSetField(base.fields, "発行元", taxOffice, false);
  paymentDocumentSetField(base.fields, "支払先", taxOffice, false);
  paymentDocumentSetField(base.fields, "納付先", taxOffice, false);
  paymentDocumentSetField(base.fields, "税目", taxName, false);
  paymentDocumentSetField(base.fields, "宛名", payer, false);
  paymentDocumentSetField(base.fields, "会社名", payer, false);
  paymentDocumentSetField(base.fields, "支払期限・納期限", dueDate, false);
  paymentDocumentSetField(base.fields, "管理番号", managementNo, false);
  paymentDocumentSetField(base.fields, "通知書番号", managementNo, false);
  paymentDocumentSetField(base.fields, "請求・支払金額", totalAmount, false);
  paymentDocumentSetField(base.fields, "合計金額", totalAmount, false);
  paymentDocumentSetField(base.fields, "税込金額", totalAmount, false);
  paymentDocumentSetField(base.fields, "未払残高", totalAmount, false);
  paymentDocumentSetField(base.fields, "会計区分", "tax", true);
  paymentDocumentSetField(base.fields, "未払種別", "unpaid", true);
  paymentDocumentSetField(base.fields, "勘定科目", taxName || "租税公課", false);
  paymentDocumentSetField(base.fields, "目的", taxName ? taxName + "納付" : "税金・公的支払い納付", false);
  paymentDocumentSetField(base.fields, "摘要", taxName ? taxName + " 納付" : "税金・公的支払い 納付", false);
  paymentDocumentSetField(base.fields, "未払登録", "true", true);
  paymentDocumentSetField(base.fields, "買掛登録", "false", true);

  const lineParts = [];
  if (taxName && baseTax) lineParts.push(taxName + " " + baseTax + "円");
  if (additionalTax) lineParts.push("附帯税 " + additionalTax + "円");
  if (totalAmount) lineParts.push("合計 " + totalAmount + "円");
  paymentDocumentSetField(base.fields, "明細候補", lineParts.join("、"), false);

  base.ai_summary.document_kind = "tax_payment_notice";
  base.ai_summary.destination = "tax_public";
  base.ai_summary.payment_target = "支払対象";
  base.ai_summary.payable_target = "未払登録対象";
  base.ai_summary.expense_target = "対象外";
  base.ai_summary.tax_public = "税金・公的支払い";
  base.ai_summary.contract_insurance_lease = "対象外";
  base.ai_summary.confidence_label = "高";
  base.ai_summary.reason = "OCR本文に納付書、納付先、税目、納付期限、合計納付額などがあるため、納付書・税金公的支払いとして補正しました。";

  if (!base.warnings.some(item => String(item).includes("納付書ルール補正"))) {
    base.warnings.push("納付書ルール補正: OCR本文から納付書・税金公的支払いと判断しました。");
  }

  return base;
}
/* PAYMENT_DOCUMENT_TAX_PAYMENT_RULE_FALLBACK_20260707_END */
function buildPaymentDocumentAiPrompt(ocrText) {
  const fieldNames = [
    "書類区分", "処理先", "支払対象", "未払登録対象", "経費登録対象", "税金・公的支払", "契約・保険・リース", "AI信頼度", "AI判定理由",
    "証憑区分", "書類名", "発行元", "支払先", "宛名", "会社名", "個人名", "部署名", "担当者名", "住所", "電話番号", "メール", "Webサイト",
    "請求書番号", "領収書番号", "納付番号", "通知書番号", "管理番号", "お客様番号", "契約番号", "会員番号", "注文番号", "取引番号", "登録番号", "法人番号", "カード番号下4桁",
    "書類日付", "発行日", "請求日", "取引日・利用日", "納品日", "締日", "支払期限・納期限", "支払予定日", "引落日", "決済日", "対象開始日", "対象終了日", "契約開始日", "契約終了日", "更新日",
    "請求・支払金額", "合計金額", "税込金額", "税抜金額", "消費税額", "10%対象金額", "10%消費税", "8%対象金額", "8%消費税", "非課税・不課税", "源泉徴収額", "手数料", "延滞金", "値引・割引", "前回残高", "今回利用額", "入金額", "未払残高",
    "支払方法", "支払状態", "振込先銀行", "銀行コード", "支店名", "支店コード", "口座種別", "口座番号", "口座名義", "引落銀行", "カード会社", "カード名", "決済サービス", "コンビニ支払番号", "バーコード番号", "QR決済情報",
    "会計区分", "処理先", "未払種別", "支払先マスタ候補", "勘定科目", "税区分", "インボイス区分", "支払方法マスタ", "対象者", "目的", "案件", "部門", "摘要", "会社負担可否", "個人負担混在", "立替", "精算", "未払登録", "買掛登録", "社内メモ",
    "明細候補",
    "税目", "納付先", "年度", "期別", "公共料金お客様番号", "使用期間", "使用量", "保険種類", "リース物件", "支払回数", "メール件名", "メール送信者", "メール受信日時", "添付ファイル名", "ダウンロード日",
    "要確認メモ"
  ];

  return [
    "あなたは日本の中小企業向け会計入力補助AIです。",
    "画像は見ていません。OCR本文だけを根拠に、支払書類の下書き候補をJSONで作成してください。",
    "確定ではなく候補です。迷う場合は空文字にし、warningsに理由を書いてください。",
    "",
    "絶対ルール:",
    "- 画像を見た前提の判断は禁止。",
    "- OCR本文にない情報を作らない。",
    "- 金額はカンマなしの数字文字列、または数値。",
    "- 日付は分かる場合だけ YYYY-MM-DD。",
    "- 分からない項目は空文字。",
    "",
    "コード候補:",
    "document_type_code: invoice, tax_payment_notice, receipt, web_statement, card_statement, utility_notice, insurance_notice, lease_contract, mail_saved, contract, other",
    "payment_destination_code: payable, accounts_payable, expense, tax_public, card_payable, contract_insurance_lease, no_process, needs_review",
    "accounting_category_code: normal, advance_payment, tax, public_utility, insurance, lease, asset, mixed_personal, needs_review",
    "payable_kind_code: accounts_payable, unpaid, accrued_expense, card_payable, other",
    "source_type_code: scan_upload, pdf_upload, mail_saved, web_download, manual_upload, other",
    "",
    "業務判断ルール:",
    "- 請求書、振込先、支払期限、請求金額がある場合は document_type_code=invoice、payment_destination_code=payable を第一候補にする。",
    "- 仕入・材料・外注など、商品やサービスを後払いで受けている内容は payable_kind_code=accounts_payable または unpaid を候補にする。",
    "- 法人税、消費税、住民税、事業税、源泉所得税、社会保険、労働保険などは document_type_code=tax_payment_notice、payment_destination_code=tax_public、accounting_category_code=tax を候補にする。",
    "- 電気、ガス、水道、通信、電話、インターネット等の利用明細や払込票は document_type_code=utility_notice、accounting_category_code=public_utility を候補にする。",
    "- クレジットカード利用明細、カード会社名、利用日、引落日、カード番号下4桁が中心なら document_type_code=card_statement、payment_destination_code=card_payable、payable_kind_code=card_payable を候補にする。",
    "- 保険料、保険証券、保険期間、契約者、被保険者が中心なら document_type_code=insurance_notice、payment_destination_code=contract_insurance_lease、accounting_category_code=insurance を候補にする。",
    "- リース契約、賃貸借、契約期間、月額、支払回数が中心なら document_type_code=lease_contract、payment_destination_code=contract_insurance_lease、accounting_category_code=lease を候補にする。",
    "- 領収済、領収書、受領印、支払済が明確なら document_type_code=receipt。未払登録は原則しないが、経費登録候補にする。",
    "- メール本文、件名、送信者、添付ファイル名の情報が中心なら source_type_code=mail_saved、document_type_code=mail_saved を候補にする。",
    "- 金額が複数ある場合は、支払うべき最終金額を total_amount、消費税額だけを tax_amount に入れる。判断できない場合は該当fieldsへ残して warnings に書く。",
    "- 宛名が株式会社HDオリジンスタイル、HD Origin、坂口喜康などの場合は宛名・会社名・個人名へ分ける。支払先と宛名を混同しない。",
    "- マスタ選択項目はコード候補に合う場合だけコードを入れる。合わない場合は fields 側に文字で残し、コードは空文字にする。",
    "- 要確認のときは needs_review を使い、無理に payable や expense に寄せない。",
    "",
    "返すJSON形式:",
    "{",
    '  "document_type_code": "",',
    '  "payment_destination_code": "",',
    '  "accounting_category_code": "",',
    '  "payable_kind_code": "",',
    '  "source_type_code": "",',
    '  "vendor_name": "",',
    '  "issue_date": "",',
    '  "due_date": "",',
    '  "invoice_number": "",',
    '  "total_amount": null,',
    '  "tax_amount": null,',
    '  "currency": "JPY",',
    '  "summary": "",',
    '  "memo": "",',
    '  "ai_summary": {',
    '    "document_kind": "",',
    '    "destination": "",',
    '    "payment_target": "",',
    '    "payable_target": "",',
    '    "expense_target": "",',
    '    "tax_public": "",',
    '    "contract_insurance_lease": "",',
    '    "confidence_label": "",',
    '    "reason": ""',
    "  },",
    '  "fields": {',
    fieldNames.map(name => '    "' + name + '": ""').join(",\n"),
    "  },",
    '  "confidence": {',
    '    "document_type": 0,',
    '    "payment_destination": 0,',
    '    "vendor_name": 0,',
    '    "total_amount": 0',
    "  },",
    '  "warnings": []',
    "}",
    "",
    "OCR本文:",
    "------------------------------",
    String(ocrText || "").slice(0, 12000),
    "------------------------------"
  ].join("\n");
}
/* PAYMENT_DOCUMENT_OPENAI_WIDE_DRAFT_20260707_END */


/* PAYMENT_DOCUMENT_AI_INVOICE_TITLE_PRIORITY_20260707_START */
function paymentDocumentInvoiceTitleNormalize(value) {
  return String(value || "")
    .replace(/[　\s\r\n\t]+/g, "")
    .replace(/[・･·]/g, "")
    .replace(/[：:]/g, "")
    .replace(/[／\/]/g, "")
    .replace(/[（）()]/g, "")
    .toLowerCase();
}

function paymentDocumentInvoiceTitleHasAny(text, words) {
  const normalized = paymentDocumentInvoiceTitleNormalize(text);
  return words.some((word) => normalized.includes(paymentDocumentInvoiceTitleNormalize(word)));
}

function paymentDocumentInvoiceTitleFirstLines(ocrText, maxLines = 8) {
  return String(ocrText || "")
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .slice(0, maxLines);
}

function paymentDocumentInvoiceTitleSaysInvoice(ocrText) {
  const lines = paymentDocumentInvoiceTitleFirstLines(ocrText, 8);

  return lines.some((line) => {
    const text = String(line || "").trim();
    const normalized = paymentDocumentInvoiceTitleNormalize(text);

    if (!normalized) {
      return false;
    }

    /*
      表題としての「請求書」を見る。
      「請求番号」「請求書番号」だけでは表題扱いしない。
    */
    if (normalized === "請求書") {
      return true;
    }

    if (normalized.startsWith("請求書") && !normalized.includes("請求書番号")) {
      return true;
    }

    return false;
  });
}

function paymentDocumentInvoiceTitleReadLineValue(ocrText, labels) {
  const lines = String(ocrText || "").split(/\r?\n/);

  for (const line of lines) {
    const raw = String(line || "").trim();

    for (const label of labels) {
      const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("^\\s*" + escaped + "\\s*[：:]\\s*(.+?)\\s*$");
      const match = raw.match(re);

      if (match && match[1]) {
        return String(match[1]).trim();
      }
    }
  }

  return "";
}

function paymentDocumentInvoiceTitleMoneyDigits(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : "";
}

function paymentDocumentInvoiceTitleJapaneseDateToIso(value) {
  const text = String(value || "").trim();

  const jp = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);

  if (jp) {
    return [
      jp[1],
      String(jp[2]).padStart(2, "0"),
      String(jp[3]).padStart(2, "0")
    ].join("-");
  }

  const slash = text.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);

  if (slash) {
    return [
      slash[1],
      String(slash[2]).padStart(2, "0"),
      String(slash[3]).padStart(2, "0")
    ].join("-");
  }

  return "";
}

function paymentDocumentInvoiceTitleSetField(fields, key, domId, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  fields[key] = value;

  if (domId) {
    fields[domId] = value;
  }
}

function applyPaymentDocumentInvoiceTitlePriorityFromOcr(ocrText, draft) {
  const text = String(ocrText || "");
  const out = draft && typeof draft === "object" ? { ...draft } : {};
  const fields = out.fields && typeof out.fields === "object" ? { ...out.fields } : {};

  if (!paymentDocumentInvoiceTitleSaysInvoice(text)) {
    return out;
  }

  const isMaterialPurchase = paymentDocumentInvoiceTitleHasAny(text, [
    "靴資材",
    "資材",
    "材料",
    "部材",
    "仕入",
    "外注",
    "加工"
  ]);

  const issuer = paymentDocumentInvoiceTitleReadLineValue(text, ["発行元", "発行者", "請求元"]);
  const recipient = paymentDocumentInvoiceTitleReadLineValue(text, ["請求先", "宛名"]);
  const invoiceNo = paymentDocumentInvoiceTitleReadLineValue(text, ["請求番号", "請求書番号", "Invoice No", "InvoiceNo"]);
  const registrationNo = paymentDocumentInvoiceTitleReadLineValue(text, ["登録番号", "適格請求書発行事業者登録番号"]);
  const billingDate = paymentDocumentInvoiceTitleJapaneseDateToIso(paymentDocumentInvoiceTitleReadLineValue(text, ["請求日"]));
  const dueDate = paymentDocumentInvoiceTitleJapaneseDateToIso(paymentDocumentInvoiceTitleReadLineValue(text, ["支払期限", "支払期日"]));
  const itemName = paymentDocumentInvoiceTitleReadLineValue(text, ["品名", "内容", "摘要"]);
  const taxExcluded = paymentDocumentInvoiceTitleMoneyDigits(paymentDocumentInvoiceTitleReadLineValue(text, ["税抜金額", "税抜額"]));
  const taxAmount = paymentDocumentInvoiceTitleMoneyDigits(paymentDocumentInvoiceTitleReadLineValue(text, ["消費税", "消費税額"]));
  const totalAmount = paymentDocumentInvoiceTitleMoneyDigits(paymentDocumentInvoiceTitleReadLineValue(text, ["請求合計", "請求合計額", "合計", "合計金額"]));

  /*
    最優先:
    表題に「請求書」と書いてあるなら、書類区分は請求書。
    税金・納付書補正が前で走っていてもここで戻す。
  */
  out.document_type_code = "invoice";
  out.payment_destination_code = isMaterialPurchase ? "accounts_payable" : "payable";
  out.accounting_category_code = isMaterialPurchase ? "purchase" : "expense";
  out.payable_kind_code = isMaterialPurchase ? "accounts_payable" : "unpaid";

  out.ai_summary = {
    ...(out.ai_summary && typeof out.ai_summary === "object" ? out.ai_summary : {}),
    document_kind: "請求書",
    destination: isMaterialPurchase ? "未払・買掛" : "未払",
    payable_flag: "支払対象",
    unpaid_flag: "登録する",
    expense_flag: isMaterialPurchase ? "対象外" : "経費",
    tax_public_flag: "対象外",
    contract_flag: "対象外",
    confidence: "高",
    reason: isMaterialPurchase
      ? "OCR本文の表題に「請求書」と明記されているため、書類区分は請求書として補正しました。品名が資材系のため、材料仕入・買掛候補です。"
      : "OCR本文の表題に「請求書」と明記されているため、書類区分は請求書として補正しました。"
  };

  paymentDocumentInvoiceTitleSetField(fields, "document_title", "draftDocumentTitle", "請求書");
  paymentDocumentInvoiceTitleSetField(fields, "issuer", "draftIssuer", issuer);
  paymentDocumentInvoiceTitleSetField(fields, "vendor_name", "draftVendorName", issuer);
  paymentDocumentInvoiceTitleSetField(fields, "recipient", "draftRecipient", recipient);
  paymentDocumentInvoiceTitleSetField(fields, "company_name", "draftCompanyName", recipient.replace(/\s*御中\s*$/, ""));
  paymentDocumentInvoiceTitleSetField(fields, "invoice_no", "draftInvoiceNo", invoiceNo);
  paymentDocumentInvoiceTitleSetField(fields, "registration_no", "draftRegistrationNo", registrationNo);
  paymentDocumentInvoiceTitleSetField(fields, "document_date", "draftDocumentDate", billingDate);
  paymentDocumentInvoiceTitleSetField(fields, "issue_date", "draftIssueDate", billingDate);
  paymentDocumentInvoiceTitleSetField(fields, "billing_date", "draftBillingDate", billingDate);
  paymentDocumentInvoiceTitleSetField(fields, "due_date", "draftDueDate", dueDate);
  paymentDocumentInvoiceTitleSetField(fields, "amount", "draftAmount", totalAmount);
  paymentDocumentInvoiceTitleSetField(fields, "total_amount", "draftTotalAmount", totalAmount);
  paymentDocumentInvoiceTitleSetField(fields, "amount_in_tax", "draftAmountInTax", totalAmount);
  paymentDocumentInvoiceTitleSetField(fields, "tax_excluded_amount", "draftTaxExcludedAmount", taxExcluded);
  paymentDocumentInvoiceTitleSetField(fields, "amount_without_tax", "draftAmountWithoutTax", taxExcluded);
  paymentDocumentInvoiceTitleSetField(fields, "tax_amount", "draftTaxAmount", taxAmount);
  paymentDocumentInvoiceTitleSetField(fields, "summary", "draftSummary", itemName || "請求書");
  paymentDocumentInvoiceTitleSetField(fields, "payable_registration_flag", "draftPayableRegistrationFlag", true);
  paymentDocumentInvoiceTitleSetField(fields, "accounts_payable_flag", "draftAccountsPayableFlag", !!isMaterialPurchase);

  const dummyNote = paymentDocumentInvoiceTitleHasAny(text, ["ダミー証憑", "開発テスト用", "実在の取引ではありません"])
    ? "これは開発テスト用のダミー証憑です。実在の取引ではありません。"
    : "";

  if (dummyNote) {
    const currentMemo = String(fields.memo || fields.draftMemo || "").trim();
    paymentDocumentInvoiceTitleSetField(
      fields,
      "memo",
      "draftMemo",
      currentMemo ? currentMemo + "\n" + dummyNote : dummyNote
    );
  }

  out.fields = fields;

  const warnings = Array.isArray(out.warnings) ? out.warnings : [];
  out.warnings = warnings.filter((warning) => !String(warning || "").includes("納付書ルール補正"));

  if (dummyNote) {
    out.warnings.push("開発テスト用のダミー証憑であるため、本登録前に人間確認が必要です。");
  }

  return out;
}
/* PAYMENT_DOCUMENT_AI_INVOICE_TITLE_PRIORITY_20260707_END */

/* PAYMENT_DOCUMENT_AI_INVOICE_CLEANUP_20260707_START */
function paymentDocumentInvoiceCleanupNormalize(value) {
  return String(value || "")
    .replace(/[　\s\r\n\t]+/g, "")
    .replace(/[・･·]/g, "")
    .replace(/[：:]/g, "")
    .replace(/[／\/]/g, "")
    .replace(/[（）()]/g, "")
    .toLowerCase();
}

function paymentDocumentInvoiceCleanupHasAny(text, words) {
  const normalized = paymentDocumentInvoiceCleanupNormalize(text);
  return words.some((word) => normalized.includes(paymentDocumentInvoiceCleanupNormalize(word)));
}

function paymentDocumentInvoiceCleanupFirstLines(ocrText, maxLines = 8) {
  return String(ocrText || "")
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .slice(0, maxLines);
}

function paymentDocumentInvoiceCleanupTitleSaysInvoice(ocrText) {
  const lines = paymentDocumentInvoiceCleanupFirstLines(ocrText, 8);

  return lines.some((line) => {
    const normalized = paymentDocumentInvoiceCleanupNormalize(line);

    if (normalized === "請求書") {
      return true;
    }

    if (normalized.startsWith("請求書") && !normalized.includes("請求書番号")) {
      return true;
    }

    return false;
  });
}

function paymentDocumentInvoiceCleanupReadLineValue(ocrText, labels) {
  const lines = String(ocrText || "").split(/\r?\n/);

  for (const line of lines) {
    const raw = String(line || "").trim();

    for (const label of labels) {
      const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("^\\s*" + escaped + "\\s*[：:]\\s*(.+?)\\s*$");
      const match = raw.match(re);

      if (match && match[1]) {
        return String(match[1]).trim();
      }
    }
  }

  return "";
}

function paymentDocumentInvoiceCleanupCompanyName(value) {
  return String(value || "")
    .replace(/\s*御中\s*$/g, "")
    .replace(/\s*様\s*$/g, "")
    .trim();
}

function paymentDocumentInvoiceCleanupUniqueLines(value) {
  const seen = new Set();
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  const out = [];

  for (const line of lines) {
    if (seen.has(line)) {
      continue;
    }

    seen.add(line);
    out.push(line);
  }

  return out.join("\n");
}

function paymentDocumentInvoiceCleanupUniqueArray(values) {
  const seen = new Set();
  const out = [];

  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value || "").trim();

    if (!text) {
      continue;
    }

    if (seen.has(text)) {
      continue;
    }

    seen.add(text);
    out.push(text);
  }

  return out;
}

function paymentDocumentInvoiceCleanupSet(fields, key, domId, value) {
  fields[key] = value;

  if (domId) {
    fields[domId] = value;
  }
}

function paymentDocumentInvoiceCleanupVisibleLabels(labels) {
  const taxLabelWords = [
    "税目",
    "納付先",
    "年度",
    "期別",
    "納付番号",
    "通知書番号",
    "管理番号",
    "延滞金",
    "非課税・不課税"
  ];

  const list = Array.isArray(labels) ? labels : [];

  return list.filter((label) => {
    const text = String(label || "");

    return !taxLabelWords.some((word) => text.includes(word));
  });
}

function applyPaymentDocumentInvoiceCleanupFromOcr(ocrText, draft) {
  const text = String(ocrText || "");
  const out = draft && typeof draft === "object" ? { ...draft } : {};
  const fields = out.fields && typeof out.fields === "object" ? { ...out.fields } : {};

  if (!paymentDocumentInvoiceCleanupTitleSaysInvoice(text)) {
    return out;
  }

  const isMaterialPurchase = paymentDocumentInvoiceCleanupHasAny(text, [
    "靴資材",
    "資材",
    "材料",
    "部材",
    "仕入",
    "外注",
    "加工"
  ]);

  const issuer = paymentDocumentInvoiceCleanupReadLineValue(text, ["発行元", "発行者", "請求元"]);
  const recipient = paymentDocumentInvoiceCleanupReadLineValue(text, ["請求先", "宛名"]);
  const companyName = paymentDocumentInvoiceCleanupCompanyName(recipient);

  /*
    請求書と明記されている場合の最終掃除。
    ここでは「税金系の残骸」を消す。
  */
  out.document_type_code = "invoice";
  out.payment_destination_code = isMaterialPurchase ? "accounts_payable" : "payable";
  out.accounting_category_code = isMaterialPurchase ? "purchase" : (out.accounting_category_code || "expense");
  out.payable_kind_code = isMaterialPurchase ? "accounts_payable" : (out.payable_kind_code || "unpaid");

  out.ai_summary = {
    ...(out.ai_summary && typeof out.ai_summary === "object" ? out.ai_summary : {}),
    document_kind: "請求書",
    destination: isMaterialPurchase ? "買掛管理" : "未払",
    payable_flag: "支払対象",
    unpaid_flag: "登録する",
    expense_flag: isMaterialPurchase ? "対象外" : "経費",
    tax_public_flag: "対象外",
    contract_flag: "対象外",
    confidence: "高",
    reason: isMaterialPurchase
      ? "OCR本文の表題に「請求書」と明記されているため、書類区分は請求書として補正しました。品名が資材系のため、材料仕入・買掛候補です。"
      : "OCR本文の表題に「請求書」と明記されているため、書類区分は請求書として補正しました。"
  };

  paymentDocumentInvoiceCleanupSet(fields, "ai_tax_public_flag", "draftAiTaxPublicFlag", "対象外");
  paymentDocumentInvoiceCleanupSet(fields, "ai_contract_flag", "draftAiContractFlag", "対象外");
  paymentDocumentInvoiceCleanupSet(fields, "ai_expense_flag", "draftAiExpenseFlag", isMaterialPurchase ? "対象外" : "経費");
  paymentDocumentInvoiceCleanupSet(fields, "ai_unpaid_flag", "draftAiUnpaidFlag", "登録する");

  if (issuer) {
    paymentDocumentInvoiceCleanupSet(fields, "issuer", "draftIssuer", issuer);
    paymentDocumentInvoiceCleanupSet(fields, "vendor_name", "draftVendorName", issuer);
  }

  if (recipient) {
    paymentDocumentInvoiceCleanupSet(fields, "recipient", "draftRecipient", recipient);
  }

  if (companyName) {
    paymentDocumentInvoiceCleanupSet(fields, "company_name", "draftCompanyName", companyName);
    fields.companyName = companyName;
    fields.recipient_company_name = companyName;
  }

  paymentDocumentInvoiceCleanupSet(fields, "payable_registration_flag", "draftPayableRegistrationFlag", true);
  paymentDocumentInvoiceCleanupSet(fields, "accounts_payable_flag", "draftAccountsPayableFlag", !!isMaterialPurchase);

  /*
    税金系の残骸を空にする。
    表示対象から外すのが主目的だが、残値も掃除する。
  */
  paymentDocumentInvoiceCleanupSet(fields, "tax_item", "draftTaxItem", "");
  paymentDocumentInvoiceCleanupSet(fields, "tax_office", "draftTaxOffice", "");
  paymentDocumentInvoiceCleanupSet(fields, "fiscal_year", "draftFiscalYear", "");
  paymentDocumentInvoiceCleanupSet(fields, "tax_term", "draftTaxTerm", "");
  paymentDocumentInvoiceCleanupSet(fields, "payment_no", "draftPaymentNo", "");
  paymentDocumentInvoiceCleanupSet(fields, "notice_no", "draftNoticeNo", "");
  paymentDocumentInvoiceCleanupSet(fields, "management_no", "draftManagementNo", "");
  paymentDocumentInvoiceCleanupSet(fields, "late_fee_amount", "draftLateFeeAmount", "");
  paymentDocumentInvoiceCleanupSet(fields, "non_tax_amount", "draftNonTaxAmount", "");

  if (fields.memo || fields.draftMemo) {
    const memo = paymentDocumentInvoiceCleanupUniqueLines(fields.memo || fields.draftMemo);
    fields.memo = memo;
    fields.draftMemo = memo;
  }

  if (fields.warnings || fields.draftWarnings) {
    const warningText = paymentDocumentInvoiceCleanupUniqueLines(
      String(fields.warnings || fields.draftWarnings || "")
        .split(/\r?\n/)
        .filter((line) => !String(line || "").includes("納付書ルール補正"))
        .join("\n")
    );

    fields.warnings = warningText;
    fields.draftWarnings = warningText;
  }

  out.fields = fields;

  out.warnings = paymentDocumentInvoiceCleanupUniqueArray(
    (Array.isArray(out.warnings) ? out.warnings : [])
      .filter((warning) => !String(warning || "").includes("納付書ルール補正"))
  );

  if (out.visible_field_labels) {
    out.visible_field_labels = paymentDocumentInvoiceCleanupVisibleLabels(out.visible_field_labels);
  }

  out.document_group = "invoice";

  return out;
}
/* PAYMENT_DOCUMENT_AI_INVOICE_CLEANUP_20260707_END */

/* PAYMENT_DOCUMENT_AI_INVOICE_FINAL_CLEANUP_20260707_START */
function paymentDocumentInvoiceFinalNormalize(value) {
  return String(value || "")
    .replace(/[　\s\r\n\t]+/g, "")
    .replace(/[・･·]/g, "")
    .replace(/[：:]/g, "")
    .replace(/[／\/]/g, "")
    .replace(/[（）()]/g, "")
    .toLowerCase();
}

function paymentDocumentInvoiceFinalHasAny(text, words) {
  const normalized = paymentDocumentInvoiceFinalNormalize(text);
  return words.some((word) => normalized.includes(paymentDocumentInvoiceFinalNormalize(word)));
}

function paymentDocumentInvoiceFinalFirstLines(ocrText, maxLines = 8) {
  return String(ocrText || "")
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .slice(0, maxLines);
}

function paymentDocumentInvoiceFinalTitleSaysInvoice(ocrText) {
  const lines = paymentDocumentInvoiceFinalFirstLines(ocrText, 8);

  return lines.some((line) => {
    const normalized = paymentDocumentInvoiceFinalNormalize(line);

    if (normalized === "請求書") {
      return true;
    }

    if (normalized.startsWith("請求書") && !normalized.includes("請求書番号")) {
      return true;
    }

    return false;
  });
}

function paymentDocumentInvoiceFinalReadLineValue(ocrText, labels) {
  const lines = String(ocrText || "").split(/\r?\n/);

  for (const line of lines) {
    const raw = String(line || "").trim();

    for (const label of labels) {
      const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("^\\s*" + escaped + "\\s*[：:]\\s*(.+?)\\s*$");
      const match = raw.match(re);

      if (match && match[1]) {
        return String(match[1]).trim();
      }
    }
  }

  return "";
}

function paymentDocumentInvoiceFinalCompanyName(value) {
  return String(value || "")
    .replace(/\s*御中\s*$/g, "")
    .replace(/\s*様\s*$/g, "")
    .trim();
}

function paymentDocumentInvoiceFinalUniqueLines(value) {
  const seen = new Set();
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  const out = [];

  for (const line of lines) {
    if (seen.has(line)) {
      continue;
    }

    seen.add(line);
    out.push(line);
  }

  return out.join("\n");
}

function paymentDocumentInvoiceFinalUniqueArray(values) {
  const seen = new Set();
  const out = [];

  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value || "").trim();

    if (!text) {
      continue;
    }

    if (seen.has(text)) {
      continue;
    }

    seen.add(text);
    out.push(text);
  }

  return out;
}

function paymentDocumentInvoiceFinalSet(fields, key, domId, value) {
  fields[key] = value;

  if (domId) {
    fields[domId] = value;
  }
}

function paymentDocumentInvoiceFinalFilterLabels(labels) {
  const blocked = [
    "税目",
    "納付先",
    "年度",
    "期別",
    "納付番号",
    "通知書番号",
    "管理番号",
    "延滞金",
    "非課税・不課税"
  ];

  return (Array.isArray(labels) ? labels : []).filter((label) => {
    const text = String(label || "");
    return !blocked.some((word) => text.includes(word));
  });
}

function applyPaymentDocumentInvoiceFinalCleanupFromOcr(ocrText, draft) {
  const text = String(ocrText || "");
  const out = draft && typeof draft === "object" ? draft : {};

  if (!paymentDocumentInvoiceFinalTitleSaysInvoice(text)) {
    return out;
  }

  const fields = out.fields && typeof out.fields === "object" ? out.fields : {};
  out.fields = fields;

  const isMaterialPurchase = paymentDocumentInvoiceFinalHasAny(text, [
    "靴資材",
    "資材",
    "材料",
    "部材",
    "仕入",
    "外注",
    "加工"
  ]);

  const issuer = paymentDocumentInvoiceFinalReadLineValue(text, ["発行元", "発行者", "請求元"]);
  const recipient = paymentDocumentInvoiceFinalReadLineValue(text, ["請求先", "宛名"]);
  const companyName = paymentDocumentInvoiceFinalCompanyName(recipient);

  /*
    最終掃除。
    ここはAIの後、分類補正の後、visible labels設定の後に呼ぶ。
  */
  out.document_type_code = "invoice";
  out.document_group = "invoice";
  out.payment_destination_code = isMaterialPurchase ? "accounts_payable" : "payable";
  out.accounting_category_code = isMaterialPurchase ? "purchase" : (out.accounting_category_code || "expense");
  out.payable_kind_code = isMaterialPurchase ? "accounts_payable" : (out.payable_kind_code || "unpaid");

  out.ai_summary = {
    ...(out.ai_summary && typeof out.ai_summary === "object" ? out.ai_summary : {}),
    document_kind: "請求書",
    destination: isMaterialPurchase ? "買掛管理" : "未払",
    payable_flag: "支払対象",
    unpaid_flag: "登録する",
    expense_flag: isMaterialPurchase ? "対象外" : "経費",
    tax_public_flag: "対象外",
    contract_flag: "対象外",
    confidence: "高",
    reason: isMaterialPurchase
      ? "OCR本文の表題に「請求書」と明記されているため、書類区分は請求書として補正しました。品名が資材系のため、材料仕入・買掛候補です。"
      : "OCR本文の表題に「請求書」と明記されているため、書類区分は請求書として補正しました。"
  };

  /*
    画面側が ai_summary ではなく fields / 直下プロパティを見る場合があるため、
    全系統に同じ値を入れる。
  */
  out.ai_tax_public_flag = "対象外";
  out.tax_public_flag = "対象外";
  out.aiTaxPublicFlag = "対象外";

  out.ai_contract_flag = "対象外";
  out.contract_flag = "対象外";
  out.aiContractFlag = "対象外";

  out.ai_expense_flag = isMaterialPurchase ? "対象外" : "経費";
  out.expense_flag = isMaterialPurchase ? "対象外" : "経費";
  out.aiExpenseFlag = isMaterialPurchase ? "対象外" : "経費";

  out.payable_registration_flag = true;
  out.accounts_payable_flag = !!isMaterialPurchase;
  out.accountsPayableFlag = !!isMaterialPurchase;

  paymentDocumentInvoiceFinalSet(fields, "ai_tax_public_flag", "draftAiTaxPublicFlag", "対象外");
  paymentDocumentInvoiceFinalSet(fields, "tax_public_flag", "draftAiTaxPublicFlag", "対象外");

  paymentDocumentInvoiceFinalSet(fields, "ai_contract_flag", "draftAiContractFlag", "対象外");
  paymentDocumentInvoiceFinalSet(fields, "contract_flag", "draftAiContractFlag", "対象外");

  paymentDocumentInvoiceFinalSet(fields, "ai_expense_flag", "draftAiExpenseFlag", isMaterialPurchase ? "対象外" : "経費");
  paymentDocumentInvoiceFinalSet(fields, "expense_flag", "draftAiExpenseFlag", isMaterialPurchase ? "対象外" : "経費");

  if (issuer) {
    paymentDocumentInvoiceFinalSet(fields, "issuer", "draftIssuer", issuer);
    paymentDocumentInvoiceFinalSet(fields, "vendor_name", "draftVendorName", issuer);
  }

  if (recipient) {
    paymentDocumentInvoiceFinalSet(fields, "recipient", "draftRecipient", recipient);
  }

  if (companyName) {
    paymentDocumentInvoiceFinalSet(fields, "company_name", "draftCompanyName", companyName);
    fields.companyName = companyName;
    fields.recipient_company_name = companyName;
    out.company_name = companyName;
    out.companyName = companyName;
  }

  paymentDocumentInvoiceFinalSet(fields, "payable_registration_flag", "draftPayableRegistrationFlag", true);
  paymentDocumentInvoiceFinalSet(fields, "accounts_payable_flag", "draftAccountsPayableFlag", !!isMaterialPurchase);

  /*
    税金系の空欄項目を残さない。
  */
  const emptyPairs = [
    ["tax_item", "draftTaxItem"],
    ["tax_office", "draftTaxOffice"],
    ["fiscal_year", "draftFiscalYear"],
    ["tax_term", "draftTaxTerm"],
    ["payment_no", "draftPaymentNo"],
    ["notice_no", "draftNoticeNo"],
    ["management_no", "draftManagementNo"],
    ["late_fee_amount", "draftLateFeeAmount"],
    ["non_tax_amount", "draftNonTaxAmount"]
  ];

  for (const pair of emptyPairs) {
    paymentDocumentInvoiceFinalSet(fields, pair[0], pair[1], "");
  }

  if (fields.memo || fields.draftMemo) {
    const memo = paymentDocumentInvoiceFinalUniqueLines(fields.memo || fields.draftMemo);
    fields.memo = memo;
    fields.draftMemo = memo;
  }

  if (fields.warnings || fields.draftWarnings) {
    const warningText = paymentDocumentInvoiceFinalUniqueLines(
      String(fields.warnings || fields.draftWarnings || "")
        .split(/\r?\n/)
        .filter((line) => !String(line || "").includes("納付書ルール補正"))
        .join("\n")
    );

    fields.warnings = warningText;
    fields.draftWarnings = warningText;
  }

  out.warnings = paymentDocumentInvoiceFinalUniqueArray(
    (Array.isArray(out.warnings) ? out.warnings : [])
      .filter((warning) => !String(warning || "").includes("納付書ルール補正"))
  );

  /* PAYMENT_DOCUMENT_AI_INVOICE_JP_LABEL_BRIDGE_20260707_START */
  /*
    HTML側は fields["税金・公的支払"] / fields["会社名"] / fields["買掛登録"] など
    日本語ラベルキーを読んでいるため、英語キーだけでなく日本語キーにも最終値を入れる。
  */
  out.ai_summary.payment_target = "支払対象";
  out.ai_summary.payable_target = "登録する";
  out.ai_summary.expense_target = isMaterialPurchase ? "対象外" : "経費";
  out.ai_summary.tax_public = "対象外";
  out.ai_summary.contract_insurance_lease = "対象外";
  out.ai_summary.confidence_label = "高";

  fields["書類名"] = "請求書";
  fields["税金・公的支払"] = "対象外";
  fields["契約・保険・リース"] = "対象外";
  fields["経費登録対象"] = isMaterialPurchase ? "対象外" : "経費";
  fields["未払登録対象"] = "登録する";
  fields["支払対象"] = "支払対象";

  if (issuer) {
    fields["発行元"] = issuer;
    fields["支払先"] = issuer;
  }

  if (recipient) {
    fields["宛名"] = recipient;
  }

  if (companyName) {
    fields["会社名"] = companyName;
  }

  fields["未払登録"] = "true";
  fields["買掛登録"] = isMaterialPurchase ? "true" : "false";

  /*
    請求書では税金系追加項目を空欄にして、表示対象からも外す。
  */
  fields["納付番号"] = "";
  fields["通知書番号"] = "";
  fields["管理番号"] = "";
  fields["税目"] = "";
  fields["納付先"] = "";
  fields["年度"] = "";
  fields["期別"] = "";
  fields["非課税・不課税"] = "";
  fields["延滞金"] = "";

  /*
    要確認メモは HTML 側で fields["要確認メモ"] + draft.warnings を結合するため、
    重複を避けて fields 側はいったん空に寄せる。
  */
  if (fields["要確認メモ"]) {
    fields["要確認メモ"] = "";
  }

  out.fields = fields;
  /* PAYMENT_DOCUMENT_AI_INVOICE_JP_LABEL_BRIDGE_20260707_END */
  out.visible_field_labels = paymentDocumentInvoiceFinalFilterLabels(out.visible_field_labels);

  return out;
}
/* PAYMENT_DOCUMENT_AI_INVOICE_FINAL_CLEANUP_20260707_END */

/* PAYMENT_DOCUMENT_AI_INVOICE_DISPLAY_CLEANUP_20260707_START */
function paymentDocumentInvoiceDisplayNormalize(value) {
  return String(value || "")
    .replace(/[　\s\r\n\t]+/g, "")
    .replace(/[・･·]/g, "")
    .replace(/[：:]/g, "")
    .replace(/[／\/]/g, "")
    .replace(/[（）()]/g, "")
    .toLowerCase();
}

function paymentDocumentInvoiceDisplayHasAny(text, words) {
  const normalized = paymentDocumentInvoiceDisplayNormalize(text);
  return words.some((word) => normalized.includes(paymentDocumentInvoiceDisplayNormalize(word)));
}

function paymentDocumentInvoiceDisplayFirstLines(ocrText, maxLines = 8) {
  return String(ocrText || "")
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .slice(0, maxLines);
}

function paymentDocumentInvoiceDisplayTitleSaysInvoice(ocrText) {
  const lines = paymentDocumentInvoiceDisplayFirstLines(ocrText, 8);

  return lines.some((line) => {
    const normalized = paymentDocumentInvoiceDisplayNormalize(line);

    if (normalized === "請求書") {
      return true;
    }

    if (normalized.startsWith("請求書") && !normalized.includes("請求書番号")) {
      return true;
    }

    return false;
  });
}

function paymentDocumentInvoiceDisplayReadLineValue(ocrText, labels) {
  const lines = String(ocrText || "").split(/\r?\n/);

  for (const line of lines) {
    const raw = String(line || "").trim();

    for (const label of labels) {
      const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("^\\s*" + escaped + "\\s*[：:]\\s*(.+?)\\s*$", "i");
      const match = raw.match(re);

      if (match && match[1]) {
        return String(match[1]).trim();
      }
    }
  }

  return "";
}

function paymentDocumentInvoiceDisplayMoneyDigits(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : "";
}

function paymentDocumentInvoiceDisplayUniqueList(values) {
  const seen = new Set();
  const out = [];

  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value || "").trim();

    if (!text) {
      continue;
    }

    if (seen.has(text)) {
      continue;
    }

    seen.add(text);
    out.push(text);
  }

  return out;
}

function paymentDocumentInvoiceDisplaySet(fields, key, domId, value) {
  fields[key] = value;

  if (domId) {
    fields[domId] = value;
  }
}

function paymentDocumentInvoiceDisplayMakeWarning(ocrText, warnings) {
  const text = String(ocrText || "");
  const hasDummy = paymentDocumentInvoiceDisplayHasAny(text, [
    "ダミー証憑",
    "開発テスト用",
    "実在の取引ではありません"
  ]);

  const out = [];
  const seen = new Set();

  for (const warning of Array.isArray(warnings) ? warnings : []) {
    const line = String(warning || "").trim();

    if (!line) {
      continue;
    }

    if (/ダミー|開発テスト|実在の取引/.test(line)) {
      continue;
    }

    if (seen.has(line)) {
      continue;
    }

    seen.add(line);
    out.push(line);
  }

  if (hasDummy) {
    out.unshift("開発テスト用のダミー証憑であり、実在の取引ではありません。本登録前に人間確認が必要です。");
  }

  return out;
}

function paymentDocumentInvoiceDisplayAllowedLabels(fields) {
  /*
    請求書で表示を許可するラベル。
    空欄でも人間が確認・選択する可能性が高い管理項目は残す。
    個人名/住所/電話番号/税金系/契約系など、今回の請求書に不要なものは出さない。
  */
  const always = [
    "書類区分",
    "処理先",
    "支払対象",
    "未払登録対象",
    "経費登録対象",
    "税金・公的支払",
    "契約・保険・リース",
    "AI信頼度",
    "AI判定理由",

    "証憑区分",
    "書類名",
    "発行元",
    "支払先",
    "宛名",
    "会社名",

    "請求書番号",
    "登録番号",

    "書類日付",
    "発行日",
    "請求日",
    "支払期限・納期限",

    "請求・支払金額",
    "合計金額",
    "税込金額",
    "税抜金額",
    "消費税額",

    "会計区分",
    "未払種別",
    "支払先マスタ候補",
    "勘定科目",
    "税区分",
    "対象者",
    "目的",
    "案件",
    "部門",
    "摘要",
    "会社負担可否",
    "個人負担混在",
    "未払登録",
    "買掛登録",
    "社内メモ",

    "明細候補",
    "要確認メモ"
  ];

  const keep = [];

  for (const label of always) {
    if (!keep.includes(label)) {
      keep.push(label);
    }
  }

  /*
    OCR/AIに値が入った請求書系項目があれば追加。
    ただし税金・契約・メール・カード系の書類別項目は追加しない。
  */
  const blocked = [
    "税目",
    "納付先",
    "年度",
    "期別",
    "納付番号",
    "通知書番号",
    "管理番号",
    "延滞金",
    "非課税・不課税",
    "領収書番号",
    "契約番号",
    "会員番号",
    "カード番号下4桁",
    "保険種類",
    "リース物件",
    "支払回数",
    "メール件名",
    "メール送信者",
    "メール受信日時",
    "添付ファイル名",
    "ダウンロード日"
  ];

  for (const [label, value] of Object.entries(fields || {})) {
    if (!String(label || "").trim()) {
      continue;
    }

    if (blocked.some((word) => String(label).includes(word))) {
      continue;
    }

    if (value === null || value === undefined || String(value).trim() === "") {
      continue;
    }

    if (!keep.includes(label)) {
      keep.push(label);
    }
  }

  return keep;
}

function applyPaymentDocumentInvoiceDisplayCleanupFromOcr(ocrText, draft) {
  const text = String(ocrText || "");
  const out = draft && typeof draft === "object" ? draft : {};

  if (!paymentDocumentInvoiceDisplayTitleSaysInvoice(text)) {
    return out;
  }

  const fields = out.fields && typeof out.fields === "object" ? out.fields : {};
  out.fields = fields;

  const registrationNo = paymentDocumentInvoiceDisplayReadLineValue(text, [
    "登録番号",
    "適格請求書発行事業者登録番号"
  ]);

  const taxExcluded = paymentDocumentInvoiceDisplayMoneyDigits(
    paymentDocumentInvoiceDisplayReadLineValue(text, [
      "税抜金額",
      "税抜額",
      "税抜"
    ])
  );

  if (registrationNo) {
    paymentDocumentInvoiceDisplaySet(fields, "登録番号", "draftRegistrationNo", registrationNo);
    fields.registration_no = registrationNo;
    fields.invoice_registration_no = registrationNo;
  }

  if (taxExcluded) {
    paymentDocumentInvoiceDisplaySet(fields, "税抜金額", "draftAmountExTax", taxExcluded);
    fields.amount_ex_tax = taxExcluded;
    fields.tax_excluded_amount = taxExcluded;
    fields.amount_without_tax = taxExcluded;
  }

  /*
    請求書では不要な書類別項目の残値を消す。
  */
  const removeLabels = [
    "納付番号",
    "通知書番号",
    "管理番号",
    "税目",
    "納付先",
    "年度",
    "期別",
    "非課税・不課税",
    "延滞金",
    "契約番号",
    "会員番号",
    "カード番号下4桁",
    "保険種類",
    "リース物件",
    "支払回数",
    "メール件名",
    "メール送信者",
    "メール受信日時",
    "添付ファイル名",
    "ダウンロード日"
  ];

  for (const label of removeLabels) {
    fields[label] = "";
  }

  /*
    要確認メモは HTML が fields["要確認メモ"] + draft.warnings を結合するため、
    fields側は空にして warnings側に1本化する。
  */
  fields["要確認メモ"] = "";
  fields.draftWarnings = "";
  fields.warnings = "";

  out.warnings = paymentDocumentInvoiceDisplayMakeWarning(text, out.warnings);

  /*
    表示許可リストを請求書用に作り直す。
    これにより空欄だけの不要項目・税金系項目を画面から落とす。
  */
  out.visible_field_labels = paymentDocumentInvoiceDisplayAllowedLabels(fields);

  return out;
}
/* PAYMENT_DOCUMENT_AI_INVOICE_DISPLAY_CLEANUP_20260707_END */
/* PAYMENT_DOCUMENT_AI_2STEP_CLASSIFY_DETAIL_20260707_START */
function paymentDocumentAiAllFieldLabels() {
  return [
    "書類区分", "処理先", "支払対象", "未払登録対象", "経費登録対象", "税金・公的支払", "契約・保険・リース", "AI信頼度", "AI判定理由",
    "証憑区分", "書類名", "発行元", "支払先", "宛名", "会社名", "個人名", "部署名", "担当者名", "住所", "電話番号", "メール", "Webサイト",
    "請求書番号", "領収書番号", "納付番号", "通知書番号", "管理番号", "お客様番号", "契約番号", "会員番号", "注文番号", "取引番号", "登録番号", "法人番号", "カード番号下4桁",
    "書類日付", "発行日", "請求日", "取引日・利用日", "納品日", "締日", "支払期限・納期限", "支払予定日", "引落日", "決済日", "対象開始日", "対象終了日", "契約開始日", "契約終了日", "更新日",
    "請求・支払金額", "合計金額", "税込金額", "税抜金額", "消費税額", "10%対象金額", "10%消費税", "8%対象金額", "8%消費税", "非課税・不課税", "源泉徴収額", "手数料", "延滞金", "値引・割引", "前回残高", "今回利用額", "入金額", "未払残高",
    "支払方法", "支払状態", "振込先銀行", "銀行コード", "支店名", "支店コード", "口座種別", "口座番号", "口座名義", "引落銀行", "カード会社", "カード名", "決済サービス", "コンビニ支払番号", "バーコード番号", "QR決済情報",
    "会計区分", "処理先", "未払種別", "支払先マスタ候補", "勘定科目", "税区分", "インボイス区分", "支払方法マスタ", "対象者", "目的", "案件", "部門", "摘要", "会社負担可否", "個人負担混在", "立替", "精算", "未払登録", "買掛登録", "社内メモ",
    "明細候補",
    "税目", "納付先", "年度", "期別", "公共料金お客様番号", "使用期間", "使用量", "保険種類", "リース物件", "支払回数", "メール件名", "メール送信者", "メール受信日時", "添付ファイル名", "ダウンロード日",
    "要確認メモ"
  ];
}

function paymentDocumentAiVisibleFieldLabels(group) {
  const common = [
    "書類区分", "処理先", "支払対象", "未払登録対象", "経費登録対象", "税金・公的支払", "契約・保険・リース", "AI信頼度", "AI判定理由",
    "書類区分", "証憑区分", "書類名", "発行元", "支払先", "宛名", "会社名", "個人名", "住所", "電話番号",
    "書類日付", "発行日", "支払期限・納期限",
    "請求・支払金額", "合計金額", "税込金額",
    "会計区分", "処理先", "未払種別", "支払先マスタ候補", "勘定科目", "税区分", "対象者", "目的", "部門", "摘要",
    "会社負担可否", "個人負担混在", "未払登録", "買掛登録", "社内メモ", "要確認メモ"
  ];

  const byGroup = {
    tax: [
      "納付番号", "通知書番号", "管理番号", "税目", "納付先", "年度", "期別",
      "延滞金", "非課税・不課税", "明細候補"
    ],
    invoice: [
      "請求書番号", "登録番号", "法人番号", "請求日", "締日", "支払予定日",
      "税抜金額", "消費税額", "10%対象金額", "10%消費税", "8%対象金額", "8%消費税",
      "支払方法", "支払状態", "振込先銀行", "銀行コード", "支店名", "支店コード", "口座種別", "口座番号", "口座名義",
      "インボイス区分", "明細候補"
    ],
    card: [
      "カード会社", "カード名", "カード番号下4桁", "取引日・利用日", "引落日", "決済日",
      "今回利用額", "前回残高", "入金額", "未払残高", "引落銀行", "明細候補"
    ],
    utility: [
      "お客様番号", "公共料金お客様番号", "使用期間", "使用量", "対象開始日", "対象終了日",
      "引落日", "支払方法", "支払状態", "明細候補"
    ],
    insurance: [
      "契約番号", "保険種類", "対象開始日", "対象終了日", "契約開始日", "契約終了日", "更新日",
      "支払回数", "支払方法", "明細候補"
    ],
    lease: [
      "契約番号", "リース物件", "対象開始日", "対象終了日", "契約開始日", "契約終了日", "更新日",
      "支払回数", "支払方法", "明細候補"
    ],
    mail: [
      "メール", "メール件名", "メール送信者", "メール受信日時", "添付ファイル名", "ダウンロード日", "Webサイト"
    ],
    contract: [
      "契約番号", "契約開始日", "契約終了日", "更新日", "担当者名", "部署名", "明細候補"
    ],
    other: [
      "管理番号", "お客様番号", "取引番号", "注文番号", "明細候補"
    ]
  };

  const extra = byGroup[group] || byGroup.other;
  return Array.from(new Set([...common, ...extra]));
}

function paymentDocumentAiGroupFromDraft(draft) {
  const d = draft && typeof draft === "object" ? draft : {};
  const summary = d.ai_summary && typeof d.ai_summary === "object" ? d.ai_summary : {};
  const fields = d.fields && typeof d.fields === "object" ? d.fields : {};
  const text = [
    d.document_type_code,
    d.payment_destination_code,
    d.accounting_category_code,
    d.payable_kind_code,
    summary.document_kind,
    summary.destination,
    summary.tax_public,
    summary.contract_insurance_lease,
    fields["書類種別"],
    fields["処理先"],
    fields["税金・公的支払"],
    fields["契約・保険・リース"]
  ].join(" ").toLowerCase();

  if (text.includes("tax_payment_notice") || text.includes("tax_public") || text.includes("tax") || text.includes("税") || text.includes("納税") || text.includes("納付")) return "tax";
  if (text.includes("card_statement") || text.includes("card_payable") || text.includes("カード")) return "card";
  if (text.includes("utility_notice") || text.includes("public_utility") || text.includes("公共") || text.includes("電気") || text.includes("水道") || text.includes("ガス")) return "utility";
  if (text.includes("insurance_notice") || text.includes("insurance") || text.includes("保険")) return "insurance";
  if (text.includes("lease_contract") || text.includes("lease") || text.includes("リース")) return "lease";
  if (text.includes("mail_saved") || text.includes("メール")) return "mail";
  if (text.includes("contract") || text.includes("契約")) return "contract";
  if (text.includes("invoice") || text.includes("payable") || text.includes("請求")) return "invoice";
  return "other";
}

function buildPaymentDocumentClassificationPrompt(ocrText) {
  return [
    "あなたは日本の中小企業向け会計入力補助AIです。",
    "画像は見ていません。OCR本文だけを根拠に、支払書類を分類してください。",
    "ここでは詳細項目を拾わず、まず分類と処理方針だけを返してください。",
    "",
    "絶対ルール:",
    "- 画像を見た前提の判断は禁止。",
    "- OCR本文にない情報を作らない。",
    "- 迷う場合は needs_review を使う。",
    "",
    "document_type_code候補:",
    "invoice, tax_payment_notice, receipt, web_statement, card_statement, utility_notice, insurance_notice, lease_contract, mail_saved, contract, other",
    "",
    "payment_destination_code候補:",
    "payable, accounts_payable, expense, tax_public, card_payable, contract_insurance_lease, no_process, needs_review",
    "",
    "accounting_category_code候補:",
    "normal, advance_payment, tax, public_utility, insurance, lease, asset, mixed_personal, needs_review",
    "",
    "payable_kind_code候補:",
    "accounts_payable, unpaid, accrued_expense, card_payable, other",
    "",
    "返すJSON形式:",
    "{",
    '  "document_type_code": "",',
    '  "payment_destination_code": "",',
    '  "accounting_category_code": "",',
    '  "payable_kind_code": "",',
    '  "source_type_code": "",',
    '  "ai_summary": {',
    '    "document_kind": "",',
    '    "destination": "",',
    '    "payment_target": "",',
    '    "payable_target": "",',
    '    "expense_target": "",',
    '    "tax_public": "",',
    '    "contract_insurance_lease": "",',
    '    "confidence_label": "",',
    '    "reason": ""',
    "  },",
    '  "warnings": []',
    "}",
    "",
    "OCR本文:",
    "------------------------------",
    String(ocrText || "").slice(0, 8000),
    "------------------------------"
  ].join("\n");
}

function buildPaymentDocumentDetailPrompt(ocrText, classification, group, labels) {
  const summary = classification && classification.ai_summary ? classification.ai_summary : {};

  return [
    "あなたは日本の中小企業向け会計入力補助AIです。",
    "画像は見ていません。OCR本文だけを根拠に、支払書類の必要項目だけを抽出してください。",
    "1回目の分類結果に基づき、指定された項目だけ返してください。",
    "指定外の項目は返さないでください。",
    "",
    "分類結果:",
    "document_type_code=" + String(classification.document_type_code || ""),
    "payment_destination_code=" + String(classification.payment_destination_code || ""),
    "accounting_category_code=" + String(classification.accounting_category_code || ""),
    "payable_kind_code=" + String(classification.payable_kind_code || ""),
    "document_group=" + String(group || ""),
    "document_kind=" + String(summary.document_kind || ""),
    "reason=" + String(summary.reason || ""),
    "",
    "絶対ルール:",
    "- 画像を見た前提の判断は禁止。",
    "- OCR本文にない情報を作らない。",
    "- 分からない項目は空文字。",
    "- 金額は数値だけ。円記号やカンマは入れない。",
    "- 日付は分かる場合だけ YYYY-MM-DD。",
    "- 個人名義や会社負担可否が危ない場合は、要確認メモや社内メモに注意を書く。",
    "",
    "抽出対象項目:",
    labels.map(name => "- " + name).join("\n"),
    "",
    "返すJSON形式:",
    "{",
    '  "vendor_name": "",',
    '  "issue_date": "",',
    '  "due_date": "",',
    '  "invoice_number": "",',
    '  "total_amount": null,',
    '  "tax_amount": null,',
    '  "currency": "JPY",',
    '  "summary": "",',
    '  "memo": "",',
    '  "fields": {',
    labels.map(name => '    "' + name + '": ""').join(",\n"),
    "  },",
    '  "warnings": []',
    "}",
    "",
    "OCR本文:",
    "------------------------------",
    String(ocrText || "").slice(0, 12000),
    "------------------------------"
  ].join("\n");
}


/* PAYMENT_DOCUMENT_AI_PROMPT_SAFE_PRECISION_20260707_START */
function appendPaymentDocumentMasterCodeInstruction(prompt) {
  const basePrompt = String(prompt || "");

  if (basePrompt.includes("【支払書類AI マスタコード返却ルール】")) {
    return basePrompt;
  }

  const instruction = [
    "",
    "【支払書類AI マスタコード返却ルール】",
    "select項目・マスタ項目は、日本語の表示名ではなく、必ず下記のマスタコードで返してください。",
    "",
    "書類区分 / 書類種別 / document_type_code:",
    "- invoice = 請求書",
    "- receipt = 領収書",
    "- tax_payment_notice = 納付書・納税通知書・税金関係",
    "- card_statement = カード明細",
    "- utility_notice = 公共料金通知・利用明細",
    "- insurance_notice = 保険料通知",
    "- lease_contract = リース契約書",
    "- contract = 契約書",
    "- web_statement = Web明細",
    "- mail_saved = メール証憑",
    "- other = その他",
    "",
    "処理先 / payment_destination_code:",
    "- payable = 支払処理",
    "- accounts_payable = 買掛・仕入債務",
    "- expense = 経費処理",
    "- tax_public = 税金・公的支払い",
    "- card_payable = カード未払",
    "- contract_insurance_lease = 契約・保険・リース",
    "- no_process = 処理対象外",
    "- needs_review = 要確認",
    "",
    "会計区分 / accounting_category_code:",
    "- normal = 通常",
    "- tax = 税金",
    "- public_utility = 公共料金",
    "- insurance = 保険",
    "- lease = リース",
    "- asset = 資産",
    "- mixed_personal = 個人混在",
    "- needs_review = 要確認",
    "",
    "未払種別 / payable_kind_code:",
    "- accounts_payable = 買掛金",
    "- unpaid = 未払金",
    "- accrued_expense = 未払費用",
    "- card_payable = カード未払",
    "- other = その他",
    "",
    "分類優先ルール:",
    "- OCR本文に「リース契約書」「月額リース料」「貸主」「借主」「契約期間」があれば、document_type_code は lease_contract、payment_destination_code は contract_insurance_lease、accounting_category_code は lease を優先してください。",
    "- OCR本文に「納付書」「納税通知書」「納付先」「税目」「税務署」「法人税」「合計納付額」があれば、document_type_code は tax_payment_notice、payment_destination_code は tax_public、accounting_category_code は tax を優先してください。",
    "- OCR本文に「カード」「ご利用明細」「引落日」があれば、document_type_code は card_statement、payment_destination_code は card_payable を優先してください。",
    "- OCR本文に「電気」「ガス」「水道」「使用量」「お客様番号」があれば、document_type_code は utility_notice、accounting_category_code は public_utility を優先してください。",
    "- OCR本文に「保険」「保険料」「保険期間」があれば、document_type_code は insurance_notice、payment_destination_code は contract_insurance_lease、accounting_category_code は insurance を優先してください。",
    "",
    "fields内のselect系項目へ入れる値:",
    "- 書類種別: document_type_codeのコード",
    "- 書類区分: document_type_codeのコード",
    "- 処理先: payment_destination_codeのコード",
    "- 会計区分: accounting_category_codeのコード",
    "- 未払種別: payable_kind_codeのコード",
    "- 税金・公的支払: tax_public または false",
    "- 契約・保険・リース: lease / insurance / contract / false",
    "- 未払登録: true または false",
    "- 買掛登録: true または false",
    "",
    "禁止:",
    "- select項目に「リース契約書」「税金・公的支払い」「未払・買掛」などの日本語表示名だけを返すこと。",
    "- マスタコード候補にない独自コードを作ること。",
    "- OCR本文にない内容を断定すること。",
    "",
    "自由入力項目は日本語で構いません。",
    "例: 書類名、発行元、支払先、宛名、会社名、摘要、社内メモ、要確認メモ。"
  ].join("\n");

  return basePrompt + "\n" + instruction;
}
/* PAYMENT_DOCUMENT_AI_PROMPT_SAFE_PRECISION_20260707_END */
async function callPaymentDocumentOpenAiJson(prompt, systemMessage) {
  const apiKey = getOpenAiApiKey();

  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY が未設定です。");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      temperature: 0,
      messages: [
        {
          role: "system",
          content: systemMessage || "OCR本文だけから、支払書類の会計入力候補JSONを作成してください。必ずJSONのみを返してください。"
        },
        {
          role: "user",
          content: appendPaymentDocumentExternalPrompt(appendPaymentDocumentMasterCodeInstruction(prompt), ["business-rules.txt", "legacy.extra-rules.txt"])
        }
      ],
      response_format: {
        type: "json_object"
      }
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && data.error && data.error.message
        ? data.error.message
        : "OpenAI API error: " + response.status;

    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const content =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
      ? data.choices[0].message.content
      : "";

  const parsed = safeJsonParse(content);

  if (!parsed) {
    const error = new Error("OpenAI応答をJSONとして解析できませんでした。");
    error.statusCode = 500;
    throw error;
  }

  return {
    parsed,
    usage: data && data.usage ? data.usage : null
  };
}

async function createTwoStepAiDraftFromOcrText(ocrText) {
  const classificationPrompt = appendPaymentDocumentExternalPrompt(
    buildPaymentDocumentClassificationPrompt(ocrText),
    selectPaymentDocumentPromptFiles({
      ocrText,
      phase: "classification"
    })
  );

  const classificationResponse = await callPaymentDocumentOpenAiJson(
    classificationPrompt,
    loadPaymentDocumentPromptText(
      "classification.system.txt",
      "OCR本文だけから、支払書類の分類JSONを作成してください。必ずJSONのみを返してください。"
    )
  );

  const classification = applyPaymentDocumentInvoiceCleanupFromOcr(ocrText, applyPaymentDocumentInvoiceTitlePriorityFromOcr(ocrText, applyPaymentDocumentRuleFallbackFromOcr(ocrText, normalizeAiDraftCandidate(classificationResponse.parsed))));
  const group = paymentDocumentAiGroupFromDraft(classification);
  const visibleLabels = paymentDocumentAiVisibleFieldLabels(group);

  const detailPrompt = appendPaymentDocumentExternalPrompt(
    buildPaymentDocumentDetailPrompt(ocrText, classification, group, visibleLabels),
    selectPaymentDocumentPromptFiles({
      ocrText,
      draft: classification,
      group,
      phase: "detail"
    })
  );

  const detailResponse = await callPaymentDocumentOpenAiJson(
    detailPrompt,
    loadPaymentDocumentPromptText(
      "detail.system.txt",
      "OCR本文だけから、分類済み支払書類の必要項目JSONを作成してください。必ずJSONのみを返してください。"
    )
  );

  const detail = detailResponse.parsed && typeof detailResponse.parsed === "object" ? detailResponse.parsed : {};
  const detailFields = detail.fields && typeof detail.fields === "object" ? detail.fields : {};

  const mergedRaw = {
    ...detail,
    document_type_code: classification.document_type_code,
    payment_destination_code: classification.payment_destination_code,
    accounting_category_code: classification.accounting_category_code,
    payable_kind_code: classification.payable_kind_code,
    source_type_code: classification.source_type_code,
    ai_summary: classification.ai_summary,
    fields: detailFields,
    warnings: [
      ...(Array.isArray(classification.warnings) ? classification.warnings : []),
      ...(Array.isArray(detail.warnings) ? detail.warnings : [])
    ]
  };

  const draft = applyPaymentDocumentInvoiceCleanupFromOcr(ocrText, applyPaymentDocumentInvoiceTitlePriorityFromOcr(ocrText, applyPaymentDocumentRuleFallbackFromOcr(ocrText, normalizeAiDraftCandidate(mergedRaw))));
  draft.visible_field_labels = paymentDocumentInvoiceCleanupTitleSaysInvoice(ocrText) ? paymentDocumentInvoiceCleanupVisibleLabels(visibleLabels) : visibleLabels;
  draft.document_group = paymentDocumentInvoiceCleanupTitleSaysInvoice(ocrText) ? "invoice" : group;
  applyPaymentDocumentInvoiceFinalCleanupFromOcr(ocrText, draft);
  applyPaymentDocumentInvoiceDisplayCleanupFromOcr(ocrText, draft);
  return {
    draft,
    classification,
    document_group: draft.document_group || group,
    visible_field_labels: draft.visible_field_labels || visibleLabels,
    display_mode: "visible_fields_only",
    prompt_rule_files: {
      classification: selectPaymentDocumentPromptFiles({
        ocrText,
        phase: "classification"
      }),
      detail: selectPaymentDocumentPromptFiles({
        ocrText,
        draft: classification,
        group,
        phase: "detail"
      })
    },
    steps: [
      {
        name: "classification",
        usage: classificationResponse.usage
      },
      {
        name: "detail",
        usage: detailResponse.usage
      }
    ]
  };
}
/* PAYMENT_DOCUMENT_AI_2STEP_CLASSIFY_DETAIL_20260707_END */
/* PAYMENT_DOCUMENT_REVIEW_VISIBLE_FIELDS_MEMO_API_20260707_START */
function paymentDocumentReviewMemoStamp() {
  const d = new Date();
  const z = n => String(n).padStart(2, "0");

  return (
    String(d.getFullYear()) +
    z(d.getMonth() + 1) +
    z(d.getDate()) +
    "_" +
    z(d.getHours()) +
    z(d.getMinutes()) +
    z(d.getSeconds())
  );
}

function paymentDocumentReviewMemoDir() {
  const dir = path.join(config.projectRoot, "GPTが使う一時ファイルフォルダ", "memo");
  ensureDir(dir);
  return dir;
}

function paymentDocumentReviewMemoText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(paymentDocumentReviewMemoText).join(", ");

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function paymentDocumentReviewVisibleFieldsMemoLines(body) {
  const fields = Array.isArray(body.fields) ? body.fields : [];
  const selectedItem = body.selectedItem || {};
  const missingControls = Array.isArray(body.aiMissingControls) ? body.aiMissingControls : [];
  const lines = [];

  lines.push("==============================");
  lines.push("支払書類内容確認 表示中項目メモ");
  lines.push("==============================");
  lines.push("日時: " + new Date().toISOString());
  lines.push("");
  lines.push("[選択中OCR]");
  lines.push("selectedIndex: " + paymentDocumentReviewMemoText(body.selectedIndex));
  lines.push("selectedOcrImportId: " + paymentDocumentReviewMemoText(body.selectedOcrImportId));
  lines.push("originalFileName: " + paymentDocumentReviewMemoText(selectedItem.originalFileName));
  lines.push("savedFileName: " + paymentDocumentReviewMemoText(selectedItem.savedFileName));
  lines.push("mimeType: " + paymentDocumentReviewMemoText(selectedItem.mimeType));
  lines.push("ocrStatus: " + paymentDocumentReviewMemoText(selectedItem.ocrStatus));
  lines.push("");
  lines.push("[AI反映]");
  lines.push("aiAppliedCount: " + paymentDocumentReviewMemoText(body.aiAppliedCount));
  lines.push("aiMissingControls: " + (missingControls.length ? missingControls.join(", ") : "なし"));
  lines.push("");
  lines.push("[表示中項目]");
  lines.push("項目数: " + fields.length);

  let currentSection = "";

  for (const field of fields) {
    const section = paymentDocumentReviewMemoText(field.section) || "未分類";

    if (section !== currentSection) {
      currentSection = section;
      lines.push("");
      lines.push("---- " + currentSection + " ----");
    }

    const label = paymentDocumentReviewMemoText(field.label) || "(ラベルなし)";
    const id = paymentDocumentReviewMemoText(field.id);
    const value = paymentDocumentReviewMemoText(field.value);
    const displayText = paymentDocumentReviewMemoText(field.displayText);
    const masterType = paymentDocumentReviewMemoText(field.masterType);
    const placeholder = paymentDocumentReviewMemoText(field.placeholder);
    const isBlank = !value.trim() && !displayText.trim();

    lines.push("");
    lines.push(String(field.no || "") + ". " + label);
    lines.push("  id: " + id);

    if (masterType) {
      lines.push("  masterType: " + masterType);
    }

    if (displayText && displayText !== value) {
      lines.push("  選択表示: " + displayText);
    }

    lines.push("  値: " + (isBlank ? "[空欄]" : value));

    if (placeholder) {
      lines.push("  placeholder: " + placeholder);
    }
  }
  const ocrRawText = paymentDocumentReviewMemoText(
    body.ocrRawText ||
    selectedItem.ocrRawText ||
    selectedItem.ocr_raw_text ||
    selectedItem.ocrText ||
    ""
  ).trim();

  lines.push("");
  lines.push("[OCR本文]");

  if (ocrRawText) {
    lines.push(ocrRawText);
  } else {
    lines.push("[OCR本文なし]");
  }


  lines.push("");
  lines.push("[注意]");
  lines.push("- 画面右側の確認・下書き欄に表示されている項目を空欄込みで出したものです。");
  lines.push("- DB保存・下書き保存・本登録はしていません。");
  lines.push("- OCR本文も末尾に含めています。");

  return lines;
}

function openPaymentDocumentReviewMemoWithNotepad(filePath) {
  if (process.platform !== "win32") return false;

  try {
    const childProcess = require("child_process");
    const child = childProcess.spawn("notepad.exe", [filePath], {
      detached: true,
      stdio: "ignore"
    });

    child.unref();
    return true;
  } catch {
    return false;
  }
}
/* PAYMENT_DOCUMENT_REVIEW_VISIBLE_FIELDS_MEMO_API_20260707_END */

/* PAYMENT_DOCUMENT_AI_SORT_ONLY_20260707_START */
function paymentDocumentSortText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function paymentDocumentSortCompactOcrText(ocrText) {
  const text = String(ocrText || "").trim();

  if (text.length <= 6500) {
    return text;
  }

  return [
    text.slice(0, 5200),
    "",
    "---- OCR本文が長いため中間を省略 ----",
    "",
    text.slice(-1000)
  ].join("\n");
}

function buildPaymentDocumentSortPrompt(ocrText) {
  return [
    "支払書類の1回目仕分けだけを行ってください。",
    "詳細項目抽出はしないでください。",
    "金額・日付・番号・口座・住所・明細の抽出は禁止です。",
    "返すのは書類区分、処理先、専門解析行き先、信頼度、要確認理由だけです。",
    "",
    "OCR本文:",
    "------------------------------",
    paymentDocumentSortCompactOcrText(ocrText),
    "------------------------------"
  ].join("\n");
}

function paymentDocumentSortHasAny(text, words) {
  const s = String(text || "").replace(/\s+/g, "").toLowerCase();
  return words.some(word => s.includes(String(word || "").replace(/\s+/g, "").toLowerCase()));
}

function normalizePaymentDocumentSortCandidate(value) {
  const raw = value && typeof value === "object" ? value : {};
  const source = raw.sorting && typeof raw.sorting === "object" ? raw.sorting : raw;

  let confidence = paymentDocumentSortText(source.confidence || source.confidence_level || source.ai_confidence || "").toLowerCase();
  let confidenceLabel = paymentDocumentSortText(source.confidence_label || "");

  if (confidence === "高") confidence = "high";
  if (confidence === "中") confidence = "medium";
  if (confidence === "低") confidence = "low";

  if (!["high", "medium", "low"].includes(confidence)) {
    confidence = "medium";
  }

  if (!confidenceLabel) {
    confidenceLabel = confidence === "high" ? "高" : confidence === "low" ? "低" : "中";
  }

  const documentTypeCode = paymentDocumentSortText(
    source.document_type_code ||
    source.documentTypeCode ||
    source.document_kind_code ||
    source.documentKindCode ||
    ""
  );

  const documentTypeLabel = paymentDocumentSortText(
    source.document_type_label ||
    source.document_type_name ||
    source.documentType ||
    source.document_kind ||
    source.document_kind_label ||
    source.documentKind ||
    source.ai_document_kind ||
    ""
  );

  const destinationCode = paymentDocumentSortText(
    source.payment_destination_code ||
    source.destination_code ||
    source.paymentDestinationCode ||
    source.destination ||
    ""
  );

  const destinationLabel = paymentDocumentSortText(
    source.payment_destination_label ||
    source.payment_destination_name ||
    source.paymentDestination ||
    source.destination_label ||
    source.destinationName ||
    ""
  );

  const specialistRouteCode = paymentDocumentSortText(
    source.specialist_route_code ||
    source.next_route_code ||
    source.next_phase_code ||
    source.route_code ||
    source.source_type_code ||
    ""
  );

  const specialistRouteLabel = paymentDocumentSortText(
    source.specialist_route_label ||
    source.next_route_label ||
    source.next_phase_label ||
    source.route_label ||
    ""
  );

  const accountingCategoryCode = paymentDocumentSortText(source.accounting_category_code || "");
  const payableKindCode = paymentDocumentSortText(source.payable_kind_code || "");
  const reviewReason = paymentDocumentSortText(source.review_reason || source.needs_review_reason || source.reason || "");

  const needsReview =
    source.needs_review === true ||
    source.needsReview === true ||
    confidence === "low" ||
    destinationCode === "needs_review" ||
    documentTypeCode === "needs_review";

  return {
    document_type_code: documentTypeCode,
    document_type_label: documentTypeLabel,
    document_type_name: documentTypeLabel,
    payment_destination_code: destinationCode,
    payment_destination_label: destinationLabel,
    payment_destination_name: destinationLabel,
    specialist_route_code: specialistRouteCode,
    specialist_route_label: specialistRouteLabel,
    accounting_category_code: accountingCategoryCode,
    payable_kind_code: payableKindCode,
    source_type_code: specialistRouteCode,
    ai_confidence: confidenceLabel,
    confidence_level: confidence,
    confidence,
    confidence_label: confidenceLabel,
    needs_review: needsReview,
    review_reason: reviewReason,
    fields: {},
    ai_summary: {
      document_kind: documentTypeLabel || documentTypeCode,
      destination: destinationLabel || destinationCode,
      payment_target: destinationCode === "evidence_only" ? "対象外" : "支払対象候補",
      payable_target: destinationCode === "accounts_payable" || destinationCode === "unpaid" ? "候補" : "対象外",
      expense_target: destinationCode === "expense" ? "候補" : "対象外",
      tax_public: destinationCode === "tax_public" ? "候補" : "対象外",
      contract_insurance_lease: specialistRouteCode === "contract_insurance_lease" ? "候補" : "対象外",
      confidence_label: confidenceLabel,
      reason: reviewReason
    },
    warnings: Array.isArray(source.warnings) ? source.warnings : []
  };
}

function applyPaymentDocumentSortRuleFallbackFromOcr(ocrText, draft) {
  const text = String(ocrText || "");
  const out = draft && typeof draft === "object" ? { ...draft } : {};
  out.ai_summary = out.ai_summary && typeof out.ai_summary === "object" ? { ...out.ai_summary } : {};
  out.fields = {};

  function setIfBlank(key, value) {
    if (!paymentDocumentSortText(out[key])) {
      out[key] = value;
    }
  }

  function setSummaryIfBlank(key, value) {
    if (!paymentDocumentSortText(out.ai_summary[key])) {
      out.ai_summary[key] = value;
    }
  }

  const tax =
    paymentDocumentSortHasAny(text, ["納付書", "納税通知書", "税務署", "市税事務所", "府税", "県税", "法人税", "消費税", "源泉所得税", "固定資産税", "社会保険料", "合計納付額"]) ||
    (paymentDocumentSortHasAny(text, ["税目"]) && paymentDocumentSortHasAny(text, ["納付期限", "納付先"]));

  const card = paymentDocumentSortHasAny(text, ["カード明細", "クレジットカード", "ご利用明細", "カード会社"]);
  const receipt = paymentDocumentSortHasAny(text, ["領収書", "領収済", "支払済", "レシート"]);
  const reference = paymentDocumentSortHasAny(text, ["納品書", "注文書", "発注書", "見積書", "検収書"]);
  const contract = paymentDocumentSortHasAny(text, ["保険料", "保険契約", "リース料", "リース契約", "電気料金", "ガス料金", "水道料金", "通信費", "電話料金", "インターネット料金"]);
  const invoice = paymentDocumentSortHasAny(text, ["請求書", "請求番号", "請求合計", "支払期限"]);
  const material = paymentDocumentSortHasAny(text, ["資材", "材料", "部材", "靴資材", "仕入", "外注", "加工"]);

  if (tax) {
    setIfBlank("document_type_code", "tax_payment");
    setIfBlank("document_type_label", "税金・公的支払");
    setIfBlank("payment_destination_code", "tax_public");
    setIfBlank("payment_destination_label", "税金公的");
    setIfBlank("specialist_route_code", "tax_public");
    setIfBlank("specialist_route_label", "税金・公的支払解析");
  } else if (card) {
    setIfBlank("document_type_code", "card_statement");
    setIfBlank("document_type_label", "カード明細");
    setIfBlank("payment_destination_code", "card_payable");
    setIfBlank("payment_destination_label", "カード未払");
    setIfBlank("specialist_route_code", "card_statement");
    setIfBlank("specialist_route_label", "カード明細照合");
  } else if (receipt) {
    setIfBlank("document_type_code", "receipt");
    setIfBlank("document_type_label", "領収書・支払済み証憑");
    setIfBlank("payment_destination_code", "expense");
    setIfBlank("payment_destination_label", "経費");
    setIfBlank("specialist_route_code", "paid_evidence");
    setIfBlank("specialist_route_label", "支払済み証憑解析");
  } else if (reference) {
    setIfBlank("payment_destination_code", "evidence_only");
    setIfBlank("payment_destination_label", "照合用");
    setIfBlank("specialist_route_code", "reference_check");
    setIfBlank("specialist_route_label", "照合用");
  } else if (contract) {
    setIfBlank("payment_destination_code", "unpaid");
    setIfBlank("payment_destination_label", "未払");
    setIfBlank("specialist_route_code", "contract_insurance_lease");
    setIfBlank("specialist_route_label", "契約・保険・リース等解析");
  } else if (invoice) {
    setIfBlank("document_type_code", "invoice");
    setIfBlank("document_type_label", "請求書");
    setIfBlank("payment_destination_code", material ? "accounts_payable" : "unpaid");
    setIfBlank("payment_destination_label", material ? "買掛" : "未払");
    setIfBlank("specialist_route_code", "invoice_payable");
    setIfBlank("specialist_route_label", "請求・未払系解析");
  }

  setSummaryIfBlank("document_kind", out.document_type_label || out.document_type_code || "未判定");
  setSummaryIfBlank("destination", out.payment_destination_label || out.payment_destination_code || "未判定");
  setSummaryIfBlank("confidence_label", out.confidence_label || out.ai_confidence || "中");
  setSummaryIfBlank("reason", out.review_reason || "");

  return out;
}

async function createPaymentDocumentSortFromOcrText(ocrText) {
  const prompt = appendPaymentDocumentExternalPrompt(
    buildPaymentDocumentSortPrompt(ocrText),
    ["sorting.extra-rules.txt"]
  );

  const response = await callPaymentDocumentOpenAiJson(
    prompt,
    loadPaymentDocumentPromptText(
      "sorting.system.txt",
      "OCR本文だけから支払書類の1回目仕分けJSONを作成してください。詳細項目は抽出せず、必ずJSONのみを返してください。"
    )
  );

  const draft = applyPaymentDocumentSortRuleFallbackFromOcr(
    ocrText,
    normalizePaymentDocumentSortCandidate(response.parsed)
  );

  return {
    draft,
    classification: draft,
    sorting: draft,
    document_group: draft.specialist_route_code || draft.document_type_code || "",
    visible_field_labels: [],
    display_mode: "sorting_only",
    image_used: false,
    prompt_rule_files: {
      sorting: ["sorting.system.txt", "sorting.extra-rules.txt"]
    },
    steps: [
      {
        name: "sorting",
        usage: response.usage
      }
    ],
    ai_steps: [
      {
        name: "sorting",
        usage: response.usage
      }
    ]
  };
}
/* PAYMENT_DOCUMENT_AI_SORT_ONLY_20260707_END */
/* PAYMENT_DOCUMENT_SORT_GROW_POLISH_20260707_START */
function hdOriginSortGrowText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hdOriginSortGrowHasAny(text, words) {
  const s = String(text || "").replace(/\s+/g, "").toLowerCase();
  return words.some(word => s.includes(String(word || "").replace(/\s+/g, "").toLowerCase()));
}

function hdOriginPolishPaymentDocumentSortResult(sortResult, ocrText) {
  const result = sortResult && typeof sortResult === "object" ? { ...sortResult } : {};
  const draft = result.draft && typeof result.draft === "object" ? { ...result.draft } : {};
  const text = String(ocrText || "");

  draft.fields = {};

  const isFixedAssetTax = hdOriginSortGrowHasAny(text, [
    "固定資産税",
    "都市計画税",
    "納税通知書",
    "市税事務所",
    "税務署",
    "年税額",
    "税額合計",
    "納期限",
    "期別"
  ]);

  const isTaxPublic =
    isFixedAssetTax ||
    draft.payment_destination_code === "tax_public" ||
    draft.specialist_route_code === "tax_public" ||
    hdOriginSortGrowHasAny(text, ["納付書", "税目", "法人税", "消費税", "源泉所得税", "社会保険料"]);

  if (isTaxPublic) {
    if (!hdOriginSortGrowText(draft.document_type_code)) draft.document_type_code = "tax_payment";
    if (!hdOriginSortGrowText(draft.document_type_label)) draft.document_type_label = isFixedAssetTax ? "納付書・納税通知書" : "税金・公的支払";
    if (!hdOriginSortGrowText(draft.document_type_name)) draft.document_type_name = draft.document_type_label;

    draft.payment_destination_code = "tax_public";
    draft.payment_destination_label = "税金・公的支払い";
    draft.payment_destination_name = "税金・公的支払い";

    draft.specialist_route_code = "tax_public";
    draft.specialist_route_label = "税金・公的支払解析";
    draft.source_type_code = "tax_public";

    if (!hdOriginSortGrowText(draft.accounting_category_code)) draft.accounting_category_code = "tax";
    if (!hdOriginSortGrowText(draft.payable_kind_code)) draft.payable_kind_code = "tax_public";

    draft.confidence = draft.confidence || "high";
    draft.confidence_level = draft.confidence_level || "high";
    draft.confidence_label = draft.confidence_label || "高";
    draft.ai_confidence = draft.ai_confidence || "高";

    if (!hdOriginSortGrowText(draft.review_reason)) {
      draft.review_reason = isFixedAssetTax
        ? "固定資産税・都市計画税、納税通知書、市税事務所等の記載があるため。"
        : "納付書、税目、納付先等の記載があるため税金・公的支払と判断。";
    }

    if (draft.confidence === "low" || draft.confidence_label === "低") {
      draft.needs_review = true;
    } else if (draft.needs_review !== true) {
      draft.needs_review = false;
    }
  }

  draft.ai_summary = draft.ai_summary && typeof draft.ai_summary === "object" ? { ...draft.ai_summary } : {};
  draft.ai_summary.document_kind = draft.ai_summary.document_kind || draft.document_type_label || draft.document_type_code || "";
  draft.ai_summary.destination = draft.ai_summary.destination || draft.payment_destination_label || draft.payment_destination_code || "";
  draft.ai_summary.payment_target = draft.ai_summary.payment_target || (draft.payment_destination_code === "evidence_only" ? "対象外" : "支払対象候補");
  draft.ai_summary.payable_target = draft.ai_summary.payable_target || ((draft.payment_destination_code === "accounts_payable" || draft.payment_destination_code === "unpaid") ? "候補" : "対象外");
  draft.ai_summary.expense_target = draft.ai_summary.expense_target || (draft.payment_destination_code === "expense" ? "候補" : "対象外");
  draft.ai_summary.tax_public = draft.ai_summary.tax_public || (draft.payment_destination_code === "tax_public" ? "候補" : "対象外");
  draft.ai_summary.contract_insurance_lease = draft.ai_summary.contract_insurance_lease || (draft.specialist_route_code === "contract_insurance_lease" ? "候補" : "対象外");
  draft.ai_summary.confidence_label = draft.ai_summary.confidence_label || draft.confidence_label || draft.ai_confidence || "";
  draft.ai_summary.reason = draft.ai_summary.reason || draft.review_reason || "";

  result.draft = draft;
  result.classification = draft;
  result.sorting = draft;
  result.document_group = draft.specialist_route_code || draft.document_type_code || result.document_group || "";
  result.visible_field_labels = [];
  result.display_mode = "sorting_only";
  result.image_used = false;

  return result;
}
/* PAYMENT_DOCUMENT_SORT_GROW_POLISH_20260707_END */
/* PAYMENT_DOCUMENT_SORT_GROW_CARD_POLISH_20260707_START */
function hdOriginCardSortGrowText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hdOriginCardSortGrowHasAny(text, words) {
  const s = String(text || "").replace(/\s+/g, "").toLowerCase();
  return words.some(word => s.includes(String(word || "").replace(/\s+/g, "").toLowerCase()));
}

function hdOriginPolishPaymentDocumentCardSortResult(sortResult, ocrText) {
  const result = sortResult && typeof sortResult === "object" ? { ...sortResult } : {};
  const draft = result.draft && typeof result.draft === "object" ? { ...result.draft } : {};
  const text = String(ocrText || "");

  draft.fields = {};

  const isCardStatement = hdOriginCardSortGrowHasAny(text, [
    "カード利用明細",
    "カード会社明細",
    "クレジットカード",
    "ご利用明細",
    "カード明細",
    "カード会社",
    "利用日",
    "利用店名",
    "card",
    "処理先:カード明細照合へ",
    "購入先証憑と紐付ける",
    "カード明細は照合用"
  ]);

  if (isCardStatement) {
    draft.document_type_code = "card_statement";
    draft.document_type_label = "カード利用明細";
    draft.document_type_name = "カード利用明細";

    draft.payment_destination_code = "card_payable";
    draft.payment_destination_label = "カード未払";
    draft.payment_destination_name = "カード未払";

    draft.specialist_route_code = "card_statement";
    draft.specialist_route_label = "カード明細照合";
    draft.source_type_code = "card_statement";

    if (!hdOriginCardSortGrowText(draft.payable_kind_code)) {
      draft.payable_kind_code = "card_payable";
    }

    if (!hdOriginCardSortGrowText(draft.accounting_category_code)) {
      draft.accounting_category_code = "normal";
    }

    draft.confidence = draft.confidence || "high";
    draft.confidence_level = draft.confidence_level || "high";
    draft.confidence_label = draft.confidence_label || "高";
    draft.ai_confidence = draft.ai_confidence || "高";

    if (!hdOriginCardSortGrowText(draft.review_reason)) {
      draft.review_reason = "カード利用明細、カード会社明細等の記載があり、購入先証憑との照合対象であるため。";
    }

    if (draft.confidence === "low" || draft.confidence_label === "低") {
      draft.needs_review = true;
    } else if (draft.needs_review !== true) {
      draft.needs_review = false;
    }

    draft.ai_summary = draft.ai_summary && typeof draft.ai_summary === "object" ? { ...draft.ai_summary } : {};
    draft.ai_summary.document_kind = "カード利用明細";
    draft.ai_summary.destination = "カード未払";
    draft.ai_summary.payment_target = "支払対象候補";
    draft.ai_summary.payable_target = "対象外";
    draft.ai_summary.expense_target = "対象外";
    draft.ai_summary.tax_public = "対象外";
    draft.ai_summary.contract_insurance_lease = "対象外";
    draft.ai_summary.card_statement = "カード明細照合";
    draft.ai_summary.confidence_label = draft.confidence_label || draft.ai_confidence || "高";
    draft.ai_summary.reason = draft.review_reason;
  }

  result.draft = draft;
  result.classification = draft;
  result.sorting = draft;
  result.document_group = draft.specialist_route_code || draft.document_type_code || result.document_group || "";
  result.visible_field_labels = [];
  result.display_mode = "sorting_only";
  result.image_used = false;

  return result;
}
/* PAYMENT_DOCUMENT_SORT_GROW_CARD_POLISH_20260707_END */
/* PAYMENT_DOCUMENT_SORT_GROW_MAIL_COMM_POLISH_20260707_START */
function hdOriginMailCommSortText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hdOriginMailCommSortHasAny(text, words) {
  const s = String(text || "").replace(/\s+/g, "").toLowerCase();
  return words.some(word => s.includes(String(word || "").replace(/\s+/g, "").toLowerCase()));
}

function hdOriginPolishPaymentDocumentMailCommSortResult(sortResult, ocrText) {
  const result = sortResult && typeof sortResult === "object" ? { ...sortResult } : {};
  const draft = result.draft && typeof result.draft === "object" ? { ...result.draft } : {};
  const text = String(ocrText || "");

  draft.fields = {};

  const isMailSaved = hdOriginMailCommSortHasAny(text, [
    "メール保存証憑",
    "メール保存ファイル",
    "from",
    "subject",
    "received",
    "mail",
    "原本メール保存"
  ]);

  const isCommunication = hdOriginMailCommSortHasAny(text, [
    "通信費",
    "通信費のお知らせ",
    "電話料金",
    "インターネット料金",
    "クラウド利用料",
    "対象月",
    "ご請求額"
  ]);

  const hasCardPaymentOnly = hdOriginMailCommSortHasAny(text, [
    "支払方法:クレジットカード",
    "支払方法：クレジットカード",
    "支払方法クレジットカード"
  ]);

  const hasStrongCardStatement = hdOriginMailCommSortHasAny(text, [
    "カード利用明細",
    "カード会社明細",
    "ご利用明細",
    "利用店名",
    "カード明細は照合用",
    "購入先証憑と紐付ける",
    "処理先:カード明細照合へ",
    "処理先：カード明細照合へ"
  ]);

  const shouldOverrideCard =
    isMailSaved &&
    isCommunication &&
    (hasCardPaymentOnly || draft.payment_destination_code === "card_payable") &&
    !hasStrongCardStatement;

  if (shouldOverrideCard) {
    draft.document_type_code = "mail_saved";
    draft.document_type_label = "メール保存証憑";
    draft.document_type_name = "メール保存証憑";

    draft.payment_destination_code = "expense";
    draft.payment_destination_label = "経費";
    draft.payment_destination_name = "経費";

    draft.specialist_route_code = "contract_insurance_lease";
    draft.specialist_route_label = "契約・通信費系確認";
    draft.source_type_code = "contract_insurance_lease";

    draft.accounting_category_code = draft.accounting_category_code || "normal";
    draft.payable_kind_code = "";

    draft.confidence = draft.confidence || "high";
    draft.confidence_level = draft.confidence_level || "high";
    draft.confidence_label = draft.confidence_label || "高";
    draft.ai_confidence = draft.ai_confidence || "高";

    draft.needs_review = false;

    draft.review_reason = "メール保存証憑であり、通信費のお知らせ・ご請求額・支払方法の記載があるため。支払方法がクレジットカードでもカード明細そのものではない。";

    draft.ai_summary = draft.ai_summary && typeof draft.ai_summary === "object" ? { ...draft.ai_summary } : {};
    draft.ai_summary.document_kind = "メール保存証憑";
    draft.ai_summary.destination = "経費";
    draft.ai_summary.payment_target = "支払対象候補";
    draft.ai_summary.payable_target = "対象外";
    draft.ai_summary.expense_target = "候補";
    draft.ai_summary.tax_public = "対象外";
    draft.ai_summary.contract_insurance_lease = "候補";
    draft.ai_summary.card_statement = "対象外";
    draft.ai_summary.confidence_label = draft.confidence_label || draft.ai_confidence || "高";
    draft.ai_summary.reason = draft.review_reason;
  }

  result.draft = draft;
  result.classification = draft;
  result.sorting = draft;
  result.document_group = draft.specialist_route_code || draft.document_type_code || result.document_group || "";
  result.visible_field_labels = [];
  result.display_mode = "sorting_only";
  result.image_used = false;

  return result;
}
/* PAYMENT_DOCUMENT_SORT_GROW_MAIL_COMM_POLISH_20260707_END */
/* PAYMENT_DOCUMENT_SORT_GROW_RECEIPT_ATTENTION_POLISH_20260707_START */
function hdOriginReceiptAttentionSortText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hdOriginReceiptAttentionSortHasAny(text, words) {
  const s = String(text || "").replace(/\s+/g, "").toLowerCase();
  return words.some(word => s.includes(String(word || "").replace(/\s+/g, "").toLowerCase()));
}

function hdOriginPolishPaymentDocumentReceiptAttentionSortResult(sortResult, ocrText) {
  const result = sortResult && typeof sortResult === "object" ? { ...sortResult } : {};
  const draft = result.draft && typeof result.draft === "object" ? { ...result.draft } : {};
  const text = String(ocrText || "");

  draft.fields = {};

  const isReceipt = hdOriginReceiptAttentionSortHasAny(text, [
    "領収書",
    "領収",
    "手書き領収書",
    "支払済",
    "処理先:経費へ",
    "処理先：経費へ"
  ]);

  const needsHumanCheck = hdOriginReceiptAttentionSortHasAny(text, [
    "上様",
    "お品代",
    "但し書き",
    "但し",
    "宛名",
    "インボイス番号",
    "人間確認",
    "確認"
  ]);

  const isReceiptAttention = isReceipt && needsHumanCheck;

  if (isReceiptAttention) {
    draft.document_type_code = "receipt";
    draft.document_type_label = "領収書";
    draft.document_type_name = "領収書";

    draft.payment_destination_code = "expense";
    draft.payment_destination_label = "経費管理";
    draft.payment_destination_name = "経費管理";

    draft.specialist_route_code = "paid_evidence";
    draft.specialist_route_label = "支払済み証憑確認";
    draft.source_type_code = "paid_evidence";

    draft.accounting_category_code = draft.accounting_category_code || "normal";
    draft.payable_kind_code = "";

    draft.confidence = "medium";
    draft.confidence_level = "medium";
    draft.confidence_label = "中";
    draft.ai_confidence = "中";

    draft.needs_review = true;
    draft.review_reason = "領収書だが、宛名が上様で但し書き・インボイス番号の人間確認が必要なため。";

    draft.ai_summary = draft.ai_summary && typeof draft.ai_summary === "object" ? { ...draft.ai_summary } : {};
    draft.ai_summary.document_kind = "領収書";
    draft.ai_summary.destination = "経費管理";
    draft.ai_summary.payment_target = "支払済み証憑候補";
    draft.ai_summary.payable_target = "対象外";
    draft.ai_summary.expense_target = "候補";
    draft.ai_summary.tax_public = "対象外";
    draft.ai_summary.contract_insurance_lease = "対象外";
    draft.ai_summary.card_statement = "対象外";
    draft.ai_summary.confidence_label = "中";
    draft.ai_summary.reason = draft.review_reason;
  }

  result.draft = draft;
  result.classification = draft;
  result.sorting = draft;
  result.document_group = draft.specialist_route_code || draft.document_type_code || result.document_group || "";
  result.visible_field_labels = [];
  result.display_mode = "sorting_only";
  result.image_used = false;

  return result;
}
/* PAYMENT_DOCUMENT_SORT_GROW_RECEIPT_ATTENTION_POLISH_20260707_END */
/* PAYMENT_DOCUMENT_SORT_GROW_UTILITY_POLISH_20260707_START */
function hdOriginUtilitySortText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hdOriginUtilitySortNormalize(text) {
  return String(text || "").replace(/\s+/g, "").toLowerCase();
}

function hdOriginUtilitySortHasAny(text, words) {
  const s = hdOriginUtilitySortNormalize(text);
  return words.some(word => s.includes(String(word || "").replace(/\s+/g, "").toLowerCase()));
}

function hdOriginUtilitySortCountAny(text, words) {
  const s = hdOriginUtilitySortNormalize(text);
  let count = 0;

  words.forEach(word => {
    const w = String(word || "").replace(/\s+/g, "").toLowerCase();
    if (w && s.includes(w)) count++;
  });

  return count;
}

function hdOriginPolishPaymentDocumentUtilitySortResult(sortResult, ocrText) {
  const result = sortResult && typeof sortResult === "object" ? { ...sortResult } : {};
  const draft = result.draft && typeof result.draft === "object" ? { ...result.draft } : {};
  const text = String(ocrText || "");

  draft.fields = {};

  const isMaterialInvoice =
    hdOriginUtilitySortHasAny(text, ["請求書", "請求番号", "支払期限", "請求先"]) &&
    hdOriginUtilitySortHasAny(text, ["靴資材", "資材", "材料", "原材料", "仕入"]);

  const utilityCoreCount = hdOriginUtilitySortCountAny(text, [
    "電気料金",
    "ガス料金",
    "水道料金",
    "通信費",
    "電話料金",
    "インターネット料金",
    "クラウド利用料",
    "電力",
    "ガス会社",
    "水道局"
  ]);

  const utilityContextCount = hdOriginUtilitySortCountAny(text, [
    "web明細",
    "ｗｅｂ明細",
    "web 明細",
    "対象月",
    "使用期間",
    "契約名義",
    "請求日",
    "請求合計",
    "消費税相当額",
    "発行元"
  ]);

  const isUtility = utilityCoreCount >= 1 && utilityContextCount >= 1 && !isMaterialInvoice;

  const isRealTaxPublic = hdOriginUtilitySortHasAny(text, [
    "納付書",
    "納税通知書",
    "税目",
    "税務署",
    "市税",
    "府税",
    "県税",
    "固定資産税",
    "都市計画税",
    "法人税",
    "消費税納付",
    "源泉所得税",
    "社会保険料",
    "年税額",
    "納期限"
  ]);

  if (isUtility && !isRealTaxPublic) {
    draft.document_type_code = "utility_bill";
    draft.document_type_label = "公共料金通知書";
    draft.document_type_name = "公共料金通知書";

    draft.payment_destination_code = "expense";
    draft.payment_destination_label = "経費管理";
    draft.payment_destination_name = "経費管理";

    draft.specialist_route_code = "contract_insurance_lease";
    draft.specialist_route_label = "契約・通信費系確認";
    draft.source_type_code = "contract_insurance_lease";

    draft.accounting_category_code = draft.accounting_category_code || "utility";
    draft.accounting_category_label = "公共料金";
    draft.accounting_category_name = "公共料金";
    draft.payable_kind_code = "";

    draft.confidence = draft.confidence || "high";
    draft.confidence_level = draft.confidence_level || "high";
    draft.confidence_label = draft.confidence_label || "高";
    draft.ai_confidence = draft.ai_confidence || "高";

    if (draft.confidence === "low" || draft.confidence_label === "低") {
      draft.needs_review = true;
    } else if (draft.needs_review !== true) {
      draft.needs_review = false;
    }

    draft.review_reason = "公共料金のWeb明細であり、料金種別・契約名義・対象月または使用期間・請求合計の記載があるため。税金ではなく公共料金として扱う。";

    draft.ai_summary = draft.ai_summary && typeof draft.ai_summary === "object" ? { ...draft.ai_summary } : {};
    draft.ai_summary.document_kind = "公共料金通知書";
    draft.ai_summary.destination = "経費管理";
    draft.ai_summary.payment_target = "支払対象候補";
    draft.ai_summary.payable_target = "対象外";
    draft.ai_summary.expense_target = "候補";
    draft.ai_summary.tax_public = "対象外";
    draft.ai_summary.contract_insurance_lease = "候補";
    draft.ai_summary.card_statement = "対象外";
    draft.ai_summary.confidence_label = draft.confidence_label || draft.ai_confidence || "高";
    draft.ai_summary.reason = draft.review_reason;
  }

  result.draft = draft;
  result.classification = draft;
  result.sorting = draft;
  result.document_group = draft.specialist_route_code || draft.document_type_code || result.document_group || "";
  result.visible_field_labels = [];
  result.display_mode = "sorting_only";
  result.image_used = false;

  return result;
}
/* PAYMENT_DOCUMENT_SORT_GROW_UTILITY_POLISH_20260707_END */
/* PAYMENT_DOCUMENT_SORT_GROW_MATERIAL_INVOICE_POLISH_20260707_START */
function hdOriginMaterialInvoiceSortText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hdOriginMaterialInvoiceSortNormalize(text) {
  return String(text || "").replace(/\s+/g, "").toLowerCase();
}

function hdOriginMaterialInvoiceSortHasAny(text, words) {
  const s = hdOriginMaterialInvoiceSortNormalize(text);
  return words.some(word => s.includes(String(word || "").replace(/\s+/g, "").toLowerCase()));
}

function hdOriginPolishPaymentDocumentMaterialInvoiceSortResult(sortResult, ocrText) {
  const result = sortResult && typeof sortResult === "object" ? { ...sortResult } : {};
  const draft = result.draft && typeof result.draft === "object" ? { ...result.draft } : {};
  const text = String(ocrText || "");

  draft.fields = {};

  const isInvoice = hdOriginMaterialInvoiceSortHasAny(text, [
    "請求書",
    "請求番号",
    "支払期限",
    "請求先",
    "請求日",
    "税抜金額",
    "消費税",
    "請求合計",
    "登録番号"
  ]);

  const isMaterialPurchase = hdOriginMaterialInvoiceSortHasAny(text, [
    "靴資材",
    "靴資材一式",
    "資材",
    "材料",
    "原材料",
    "仕入",
    "材料仕入",
    "品名:靴資材",
    "品名：靴資材"
  ]);

  const isRealTaxPublic = hdOriginMaterialInvoiceSortHasAny(text, [
    "納付書",
    "納税通知書",
    "税目",
    "税務署",
    "法人税",
    "固定資産税",
    "都市計画税",
    "源泉所得税",
    "社会保険料"
  ]);

  const isMaterialInvoice = isInvoice && isMaterialPurchase && !isRealTaxPublic;

  if (isMaterialInvoice) {
    draft.document_type_code = "invoice";
    draft.document_type_label = "請求書";
    draft.document_type_name = "請求書";

    draft.payment_destination_code = "accounts_payable";
    draft.payment_destination_label = "買掛管理";
    draft.payment_destination_name = "買掛管理";

    draft.specialist_route_code = "accounts_payable";
    draft.specialist_route_label = "買掛・仕入請求確認";
    draft.source_type_code = "accounts_payable";

    draft.accounting_category_code = draft.accounting_category_code || "normal";
    draft.accounting_category_label = draft.accounting_category_label || "通常";
    draft.accounting_category_name = draft.accounting_category_name || "通常";

    draft.payable_kind_code = "purchase_payable";
    draft.payable_kind_label = "仕入買掛";
    draft.payable_kind_name = "仕入買掛";

    draft.confidence = "high";
    draft.confidence_level = "high";
    draft.confidence_label = "高";
    draft.ai_confidence = "高";

    draft.needs_review = false;
    draft.review_reason = "請求書であり、靴資材一式・支払期限・請求番号・請求合計の記載があるため、材料仕入の買掛候補と判断。";

    draft.ai_summary = draft.ai_summary && typeof draft.ai_summary === "object" ? { ...draft.ai_summary } : {};
    draft.ai_summary.document_kind = "請求書";
    draft.ai_summary.destination = "買掛管理";
    draft.ai_summary.payment_target = "支払対象候補";
    draft.ai_summary.payable_target = "候補";
    draft.ai_summary.expense_target = "対象外";
    draft.ai_summary.tax_public = "対象外";
    draft.ai_summary.contract_insurance_lease = "対象外";
    draft.ai_summary.card_statement = "対象外";
    draft.ai_summary.confidence_label = "高";
    draft.ai_summary.reason = draft.review_reason;
  }

  result.draft = draft;
  result.classification = draft;
  result.sorting = draft;
  result.document_group = draft.specialist_route_code || draft.document_type_code || result.document_group || "";
  result.visible_field_labels = [];
  result.display_mode = "sorting_only";
  result.image_used = false;

  return result;
}
/* PAYMENT_DOCUMENT_SORT_GROW_MATERIAL_INVOICE_POLISH_20260707_END */
/* PAYMENT_DOCUMENT_SORT_GROW_INSURANCE_POLISH_20260707_START */
function hdOriginInsuranceSortText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hdOriginInsuranceSortNormalize(text) {
  return String(text || "").replace(/\s+/g, "").toLowerCase();
}

function hdOriginInsuranceSortHasAny(text, words) {
  const s = hdOriginInsuranceSortNormalize(text);
  return words.some(word => s.includes(String(word || "").replace(/\s+/g, "").toLowerCase()));
}

function hdOriginPolishPaymentDocumentInsuranceSortResult(sortResult, ocrText) {
  const result = sortResult && typeof sortResult === "object" ? { ...sortResult } : {};
  const draft = result.draft && typeof result.draft === "object" ? { ...result.draft } : {};
  const text = String(ocrText || "");

  draft.fields = {};

  const isPublicInsuranceOrTax = hdOriginInsuranceSortHasAny(text, [
    "社会保険料",
    "厚生年金",
    "健康保険料",
    "労働保険料",
    "年金事務所",
    "納付書",
    "税務署",
    "税目",
    "法人税",
    "固定資産税",
    "都市計画税"
  ]);

  const isInsuranceNotice =
    !isPublicInsuranceOrTax &&
    (
      hdOriginInsuranceSortHasAny(text, ["保険料通知書"]) ||
      (
        hdOriginInsuranceSortHasAny(text, ["保険料", "保険"]) &&
        hdOriginInsuranceSortHasAny(text, ["契約番号", "契約者", "口座振替", "支払日"])
      )
    );

  if (isInsuranceNotice) {
    draft.document_type_code = "insurance_notice";
    draft.document_type_label = "保険料通知書";
    draft.document_type_name = "保険料通知書";

    draft.payment_destination_code = "contract_insurance_lease";
    draft.payment_destination_label = "契約・保険・リース";
    draft.payment_destination_name = "契約・保険・リース";

    draft.specialist_route_code = "contract_insurance_lease";
    draft.specialist_route_label = "契約・保険・リース確認";
    draft.source_type_code = "contract_insurance_lease";

    draft.accounting_category_code = "insurance";
    draft.accounting_category_label = "保険";
    draft.accounting_category_name = "保険";

    draft.payable_kind_code = "unpaid";
    draft.payable_kind_label = "未払金";
    draft.payable_kind_name = "未払金";

    draft.confidence = "high";
    draft.confidence_level = "high";
    draft.confidence_label = "高";
    draft.ai_confidence = "高";

    draft.needs_review = false;
    draft.review_reason = "保険料通知書であり、契約番号・支払日・保険料・口座振替の記載があるため。買掛ではなく契約・保険系の未払金候補として扱う。";

    draft.ai_summary = draft.ai_summary && typeof draft.ai_summary === "object" ? { ...draft.ai_summary } : {};
    draft.ai_summary.document_kind = "保険料通知書";
    draft.ai_summary.destination = "契約・保険・リース";
    draft.ai_summary.payment_target = "支払対象候補";
    draft.ai_summary.payable_target = "候補";
    draft.ai_summary.expense_target = "対象外";
    draft.ai_summary.tax_public = "対象外";
    draft.ai_summary.contract_insurance_lease = "候補";
    draft.ai_summary.card_statement = "対象外";
    draft.ai_summary.confidence_label = "高";
    draft.ai_summary.reason = draft.review_reason;
  }

  result.draft = draft;
  result.classification = draft;
  result.sorting = draft;
  result.document_group = draft.specialist_route_code || draft.document_type_code || result.document_group || "";
  result.visible_field_labels = [];
  result.display_mode = "sorting_only";
  result.image_used = false;

  return result;
}
/* PAYMENT_DOCUMENT_SORT_GROW_INSURANCE_POLISH_20260707_END */
async function handlePaymentDocumentRoutes(req, res) {
  /* PAYMENT_DOCUMENT_AI_SORT_ONLY_ROUTE_20260707_START */
  if (req.method === "POST") {
    const sortUrlPath = String(req.url || "").split("?")[0];

    if (sortUrlPath.startsWith("/api/payment-documents/ai-sort/")) {
      try {
        const idText = decodeURIComponent(sortUrlPath.replace("/api/payment-documents/ai-sort/", "")).trim();
        const id = Number(idText);

        if (!Number.isFinite(id) || id <= 0) {
          sendJson(res, 400, {
            ok: false,
            error: "OCR保存IDが不正です。"
          });
          return true;
        }

        const result = await db.query(`
          SELECT
            payment_document_ocr_import_id,
            original_file_name,
            saved_file_name,
            ocr_raw_text,
            ocr_text_length
          FROM accounting.payment_document_ocr_imports
          WHERE deleted_at IS NULL
            AND payment_document_ocr_import_id = $1
          LIMIT 1
        `, [id]);

        const row = result.rows[0];

        if (!row) {
          sendJson(res, 404, {
            ok: false,
            error: "OCR保存データが見つかりません。"
          });
          return true;
        }

        const ocrText = String(row.ocr_raw_text || "").trim();

        if (!ocrText) {
          sendJson(res, 400, {
            ok: false,
            error: "OCR本文が空のため仕分けできません。"
          });
          return true;
        }

        let sortResult = hdOriginPolishPaymentDocumentSortResult(await createPaymentDocumentSortFromOcrText(ocrText), ocrText);
        sortResult = hdOriginPolishPaymentDocumentCardSortResult(sortResult, ocrText);
        sortResult = hdOriginPolishPaymentDocumentMailCommSortResult(sortResult, ocrText);
        sortResult = hdOriginPolishPaymentDocumentReceiptAttentionSortResult(sortResult, ocrText);
        sortResult = hdOriginPolishPaymentDocumentUtilitySortResult(sortResult, ocrText);
        sortResult = hdOriginPolishPaymentDocumentMaterialInvoiceSortResult(sortResult, ocrText);
        sortResult = hdOriginPolishPaymentDocumentInsuranceSortResult(sortResult, ocrText);

        sendJson(res, 200, {
          ok: true,
          mode: "sorting_only",
          message: "1回目仕分けのみ完了しました。詳細項目抽出は行っていません。",
          paymentDocumentOcrImportId: id,
          originalFileName: row.original_file_name || "",
          savedFileName: row.saved_file_name || "",
          image_used: false,
          ...sortResult
        });
      } catch (err) {
        sendJson(res, err.statusCode || 500, {
          ok: false,
          error: err.message || String(err),
          mode: "sorting_only"
        });
      }

      return true;
    }
  }
  /* PAYMENT_DOCUMENT_AI_SORT_ONLY_ROUTE_20260707_END */

  const urlObj = new URL(req.url, "http://localhost");
  const urlPath = urlObj.pathname;
  /* PAYMENT_DOCUMENT_REVIEW_VISIBLE_FIELDS_MEMO_ROUTE_20260707_START */
  if (req.method === "POST" && urlPath === "/api/payment-documents/review-visible-fields-memo") {
    try {
      const body = await readBody(req);
      const memoDir = paymentDocumentReviewMemoDir();
      const stamp = paymentDocumentReviewMemoStamp();
      const memoPath = path.join(memoDir, "00_payment_document_review_visible_fields_" + stamp + ".txt");
      const lines = paymentDocumentReviewVisibleFieldsMemoLines(body);

      fs.writeFileSync(memoPath, lines.join("\r\n"), "utf8");

      const openedNotepad = openPaymentDocumentReviewMemoWithNotepad(memoPath);

      sendJson(res, 200, {
        ok: true,
        message: "表示中項目をmemoへ出しました。",
        count: Array.isArray(body.fields) ? body.fields.length : 0,
        memoPath,
        openedNotepad
      });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: err.message || String(err)
      });
    }

    return true;
  }
  /* PAYMENT_DOCUMENT_REVIEW_VISIBLE_FIELDS_MEMO_ROUTE_20260707_END */


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
  if (req.method === "POST" && urlPath.startsWith("/api/payment-documents/ai-draft/")) {
    try {
      const idText = decodeURIComponent(urlPath.replace("/api/payment-documents/ai-draft/", ""));
      const id = Number(idText);

      if (!Number.isInteger(id) || id < 1) {
        sendJson(res, 400, { ok: false, error: "不正なOCR取込IDです。" });
        return true;
      }

      const result = await db.query(`
        SELECT
          payment_document_ocr_import_id,
          original_file_name,
          saved_file_name,
          ocr_raw_text,
          ocr_text_length
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
      const ocrText = String(row.ocr_raw_text || "").trim();

      if (!ocrText) {
        sendJson(res, 400, { ok: false, error: "OCR本文が空です。" });
        return true;
      }

            const aiResult = await createTwoStepAiDraftFromOcrText(ocrText);
      const draft = aiResult.draft;

      sendJson(res, 200, {
        ok: true,
        source: "openai_ocr_text_only",
        image_used: false,
        paymentDocumentOcrImportId: row.payment_document_ocr_import_id,
        originalFileName: row.original_file_name || row.saved_file_name,
        ocrTextLength: row.ocr_text_length,
        ai_steps: aiResult.steps,
        display_mode: aiResult.display_mode,
        document_group: aiResult.document_group,
        visible_field_labels: aiResult.visible_field_labels,
        classification: aiResult.classification,
        draft
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, {
        ok: false,
        source: "openai_ocr_text_only",
        image_used: false,
        error: err.message || String(err)
      });
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



