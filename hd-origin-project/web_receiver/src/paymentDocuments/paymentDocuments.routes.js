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

/* HD_ORIGIN_ACCESS_OCR_LOCAL_PATH_20260717_START */
function isLocalAccessOcrRequest(req) {
  const remoteAddress = String(
    req &&
    req.socket &&
    req.socket.remoteAddress
      ? req.socket.remoteAddress
      : ""
  ).toLowerCase();

  return (
    remoteAddress === "127.0.0.1" ||
    remoteAddress === "::1" ||
    remoteAddress === "::ffff:127.0.0.1"
  );
}

function validateAccessOcrLocalFilePath(value) {
  const requestedPath = String(value || "").trim();

  if (!requestedPath) {
    throw new Error("OCR対象ファイルパスが空です。");
  }

  if (requestedPath.includes("\0")) {
    throw new Error("OCR対象ファイルパスが不正です。");
  }

  const resolvedPath = path.resolve(requestedPath);

  if (!path.isAbsolute(resolvedPath)) {
    throw new Error("OCR対象には絶対パスを指定してください。");
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error("OCR対象ファイルが見つかりません。");
  }

  const stat = fs.statSync(resolvedPath);

  if (!stat.isFile()) {
    throw new Error("OCR対象はファイルではありません。");
  }

  if (stat.size > MAX_UPLOAD_BYTES) {
    throw new Error("30MBを超えるファイルはOCRできません。");
  }

  const mimeType = getMimeType(resolvedPath);
  const extensionName = path.extname(resolvedPath).toLowerCase();

  const allowed =
    mimeType.startsWith("image/") ||
    mimeType.includes("pdf") ||
    [".pdf", ".png", ".jpg", ".jpeg", ".webp"].includes(extensionName);

  if (!allowed) {
    throw new Error("このファイル形式はOCR対象外です。");
  }

  return {
    filePath: resolvedPath,
    fileName: path.basename(resolvedPath),
    mimeType,
    sizeBytes: stat.size
  };
}

async function importAccessLocalFileAndRunOcr(body) {
  const validated = validateAccessOcrLocalFilePath(
    body.localFilePath ||
    body.filePath
  );

  const fileHash = sha256File(validated.filePath);
  const safeOriginal = safeFileName(validated.fileName);
  const saveName = timestampPrefix() + "_" + safeOriginal;
  const inboxFilePath = path.join(inboxDir(), saveName);

  fs.copyFileSync(
    validated.filePath,
    inboxFilePath
  );

  const uploadedAt = new Date().toISOString();

  writeJson(metaPathFor(inboxFilePath), {
    originalFileName: validated.fileName,
    originalFilePath: validated.filePath,
    savedFileName: saveName,
    mimeType: validated.mimeType,
    sizeBytes: validated.sizeBytes,
    sha256: fileHash,
    fileSha256: fileHash,
    sourceType: String(body.sourceType || "access_ocr_form"),
    note: String(body.note || "Access F_OCR取込解析から送信"),
    accessOcrId:
      Number.isInteger(Number(body.accessOcrId))
        ? Number(body.accessOcrId)
        : null,
    ocrStatus: "ocr_waiting",
    processStatus: "inbox",
    uploadedAt
  });

  const ocrResult = await ocrOneFile(saveName);

  return {
    ...ocrResult,
    accessOcrId:
      Number.isInteger(Number(body.accessOcrId))
        ? Number(body.accessOcrId)
        : null,
    sourceFilePath: validated.filePath,
    storedFileName: saveName
  };
}
/* HD_ORIGIN_ACCESS_OCR_LOCAL_PATH_20260717_END */
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
    const analyzed = await analyzeFileWithAzure(
      filePath,
      mimeType
    );

    const rawText = String(
      analyzed.rawText || ""
    ).trim();

    const fileHash =
      current.sha256 ||
      current.fileSha256 ||
      current.contentHash ||
      sha256File(filePath);

    const next = {
      ...current,
      ocrStatus: rawText ? "ocr_done" : "ocr_empty",
      ocrProvider:
        "azure_document_intelligence_prebuilt_read",
      ocrApiVersion: AZURE_API_VERSION,
      ocrAt: new Date().toISOString(),
      ocrRawText: rawText,
      ocr_raw_text: rawText,
      ocrText: rawText,
      ocrTextLength: rawText.length,
      ocrError: "",
      processStatus:
        rawText ? "ocr_done" : "ocr_empty",
      sha256: fileHash,
      fileSha256: fileHash,
      contentHash: fileHash,
      dbSaved: false,
      paymentDocumentOcrImportId: null,
      storageTarget: "access"
    };

    writeJson(metaPath, next);

    return {
      ok: true,
      fileName,
      originalFileName:
        next.originalFileName ||
        path.basename(filePath),
      savedFileName:
        next.savedFileName ||
        path.basename(filePath),
      savedFilePath: filePath,
      mimeType,
      sha256: fileHash,
      status: next.ocrStatus,
      ocrProvider: next.ocrProvider,
      ocrApiVersion: next.ocrApiVersion,
      ocrAt: next.ocrAt,
      ocrText: rawText,
      textLength: rawText.length,
      textPreview: rawText.slice(0, 180),
      azureResult: analyzed.rawJson || null,
      dbSaved: false,
      paymentDocumentOcrImportId: null,
      storageTarget: "access"
    };
  } catch (err) {
    const next = {
      ...current,
      ocrStatus: "ocr_error",
      ocrProvider:
        "azure_document_intelligence_prebuilt_read",
      ocrApiVersion: AZURE_API_VERSION,
      ocrAt: new Date().toISOString(),
      ocrError: err.message || String(err),
      processStatus: "ocr_error",
      dbSaved: false,
      paymentDocumentOcrImportId: null,
      storageTarget: "access"
    };

    writeJson(metaPath, next);

    return {
      ok: false,
      fileName,
      status: "ocr_error",
      error: err.message || String(err),
      dbSaved: false,
      paymentDocumentOcrImportId: null,
      storageTarget: "access"
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

/* HD_ORIGIN_OCR_AUTO_DB_SAVE_MIN_V4_20260708_START */
async function upsertPaymentDocumentOcrImportWithTransaction(meta, fallbackFileName) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const ocrText = textOrEmpty(meta.ocrRawText || meta.ocr_raw_text || meta.ocrText);

    if (!ocrText) {
      await client.query("COMMIT");
      return null;
    }

    const documentKey = documentKeyFromMeta(meta, fallbackFileName);
    const originalFileName = textOrEmpty(meta.originalFileName || fallbackFileName);
    const savedFileName = textOrEmpty(meta.savedFileName || fallbackFileName);
    const sha256 = textOrEmpty(meta.sha256 || meta.fileSha256 || meta.contentHash);

    const result = await client.query(`
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
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      documentKey,
      originalFileName,
      savedFileName,
      textOrEmpty(meta.mimeType),
      Number(meta.sizeBytes || 0) || null,
      sha256 || null,
      textOrEmpty(meta.documentType),
      textOrEmpty(meta.destination),
      textOrEmpty(meta.sourceType),
      textOrEmpty(meta.vendorName),
      textOrEmpty(meta.note),
      textOrEmpty(meta.emailSubject),
      textOrEmpty(meta.emailFrom),
      textOrEmpty(meta.emailReceivedAt),
      textOrEmpty(meta.ocrStatus || "ocr_done"),
      textOrEmpty(meta.ocrProvider),
      textOrEmpty(meta.ocrApiVersion),
      dateOrNull(meta.ocrAt),
      ocrText,
      Number(meta.ocrTextLength || ocrText.length || 0) || null,
      textOrEmpty(meta.ocrError),
      textOrEmpty(meta.processStatus || "ocr_done"),
      textOrEmpty(meta.saveStatus || meta.savedStatus),
      !!meta.evidenceSaved,
      !!meta.ocrSaved,
      textOrEmpty(meta.savedRelativePath),
      textOrEmpty(meta.savedMetaRelativePath),
      dateOrNull(meta.savedAt),
      textOrEmpty(meta.savedByPage)
    ]);

    await client.query("COMMIT");
    return result.rows[0] || null;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // 元エラーを優先
    }

    throw err;
  } finally {
    client.release();
  }
}
/* HD_ORIGIN_OCR_AUTO_DB_SAVE_MIN_V4_20260708_END */

async function listPaymentDocumentOcrImportsFromDb() {
  const result = await db.query(`
    SELECT
      o.payment_document_ocr_import_id,
      o.original_file_name,
      o.saved_file_name,
      o.mime_type,
      o.size_bytes,
      o.sha256,
      o.document_type,
      o.destination,
      o.source_type,
      o.vendor_name,
      o.note,
      o.email_subject,
      o.email_from,
      o.email_received_at,
      o.ocr_status,
      o.ocr_provider,
      o.ocr_api_version,
      o.ocr_at,
      o.ocr_raw_text,
      o.ocr_text_length,
      o.process_status,
      o.save_status,
      o.evidence_saved,
      o.ocr_saved,
      o.saved_relative_path,
      o.saved_meta_relative_path,
      o.saved_at,
      o.saved_by_page,
      o.draft_status,
      o.latest_sorting_draft_id,
      o.sorted_at,
      o.created_at,
      o.updated_at,

      d.payment_document_sorting_draft_id AS current_sorting_draft_id,
      d.draft_no AS current_sorting_draft_no,
      d.draft_status AS current_sorting_draft_status,
      d.human_check_status AS current_human_check_status,
      d.document_type_code AS current_document_type_code,
      d.document_type_label AS current_document_type_label,
      d.payment_destination_code AS current_payment_destination_code,
      d.payment_destination_label AS current_payment_destination_label,
      d.accounting_category_code AS current_accounting_category_code,
      d.accounting_category_label AS current_accounting_category_label,
      d.payable_kind_code AS current_payable_kind_code,
      d.payable_kind_label AS current_payable_kind_label,
      d.specialist_route_code AS current_specialist_route_code,
      d.specialist_route_label AS current_specialist_route_label,
      d.analysis_system_id AS current_analysis_system_id,
      d.analysis_system_code AS current_analysis_system_code,
      d.analysis_system_label AS current_analysis_system_label,
      d.analysis_system_reason AS current_analysis_system_reason,
      d.analysis_system_confidence AS current_analysis_system_confidence,
      d.payment_target_label AS current_payment_target_label,
      d.payable_target_label AS current_payable_target_label,
      d.expense_target_label AS current_expense_target_label,
      d.tax_public_label AS current_tax_public_label,
      d.public_utility_label AS current_public_utility_label,
      d.contract_insurance_lease_label AS current_contract_insurance_lease_label,
      d.ai_confidence AS current_ai_confidence,
      d.ai_confidence_label AS current_ai_confidence_label,
      d.ai_reason AS current_ai_reason,
      d.review_reason AS current_review_reason,
      d.needs_review AS current_needs_review,
      d.ai_summary_json AS current_ai_summary_json,
      d.sort_result_json AS current_sort_result_json,
      d.visible_fields_json AS current_visible_fields_json,
      d.warnings_json AS current_warnings_json,
      d.display_rotation AS current_display_rotation,
      d.memo AS current_sorting_memo,
      d.created_at AS current_sorting_created_at,
      d.updated_at AS current_sorting_updated_at
    FROM accounting.payment_document_ocr_imports o
    LEFT JOIN accounting.payment_document_sorting_drafts d
      ON d.payment_document_sorting_draft_id = o.latest_sorting_draft_id
     AND d.deleted_at IS NULL
    WHERE o.deleted_at IS NULL
      AND COALESCE(o.ocr_raw_text, '') <> ''
    ORDER BY
      o.sorted_at DESC NULLS LAST,
      o.saved_at DESC NULLS LAST,
      o.ocr_at DESC NULLS LAST,
      o.payment_document_ocr_import_id DESC
    LIMIT 500
  `);

  return result.rows.map(row => {
    const latestSortingDraft = row.current_sorting_draft_id
      ? {
          paymentDocumentSortingDraftId: row.current_sorting_draft_id,
          paymentDocumentOcrImportId: row.payment_document_ocr_import_id,
          draftNo: row.current_sorting_draft_no,
          draftStatus: row.current_sorting_draft_status,
          humanCheckStatus: row.current_human_check_status,

          documentTypeCode: row.current_document_type_code,
          documentTypeLabel: row.current_document_type_label,
          paymentDestinationCode: row.current_payment_destination_code,
          paymentDestinationLabel: row.current_payment_destination_label,
          accountingCategoryCode: row.current_accounting_category_code,
          accountingCategoryLabel: row.current_accounting_category_label,
          payableKindCode: row.current_payable_kind_code,
          payableKindLabel: row.current_payable_kind_label,
          specialistRouteCode: row.current_specialist_route_code,
          specialistRouteLabel: row.current_specialist_route_label,
          analysisSystemId: row.current_analysis_system_id,
          analysisSystemCode: row.current_analysis_system_code,
          analysisSystemLabel: row.current_analysis_system_label,
          analysisSystemReason: row.current_analysis_system_reason,
          analysisSystemConfidence: row.current_analysis_system_confidence,

          paymentTargetLabel: row.current_payment_target_label,
          payableTargetLabel: row.current_payable_target_label,
          expenseTargetLabel: row.current_expense_target_label,
          taxPublicLabel: row.current_tax_public_label,
          publicUtilityLabel: row.current_public_utility_label,
          contractInsuranceLeaseLabel: row.current_contract_insurance_lease_label,

          aiConfidence: row.current_ai_confidence,
          aiConfidenceLabel: row.current_ai_confidence_label,
          aiReason: row.current_ai_reason,
          reviewReason: row.current_review_reason,
          needsReview: !!row.current_needs_review,

          aiSummary: row.current_ai_summary_json || {},
          sortResult: row.current_sort_result_json || {},
          visibleFields: row.current_visible_fields_json || {},
          warnings: row.current_warnings_json || [],

          displayRotation: row.current_display_rotation,
          memo: row.current_sorting_memo,
          createdAt: row.current_sorting_created_at,
          updatedAt: row.current_sorting_updated_at
        }
      : null;

    return {
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
      latestSortingDraftId: row.latest_sorting_draft_id,
      sortedAt: row.sorted_at,
      latestSortingDraft,

      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });
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
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return draft;
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
/* HD_ORIGIN_OTHER_EVIDENCE_FALLBACK_20260707_START */
function applyPaymentDocumentOtherEvidenceFallbackFromOcr(ocrText, draft) {
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return draft;
  const text = String(ocrText || "");
  const compact = text.replace(/\s+/g, "");
  const base = draft && typeof draft === "object" ? { ...draft } : {};

  base.fields = base.fields && typeof base.fields === "object" ? { ...base.fields } : {};
  base.ai_summary = base.ai_summary && typeof base.ai_summary === "object" ? { ...base.ai_summary } : {};
  base.warnings = Array.isArray(base.warnings) ? [...base.warnings] : [];

  const looksOtherNeedsReview =
    /その他\s*証\s*憑|その他証憑|書類種別[:：]\s*未判定|未判定|確認待ち|処理先[:：]\s*保留|保留/.test(text) ||
    /その他証憑|書類種別未判定|内容確認待ち|処理先保留/.test(compact);

  if (!looksOtherNeedsReview) {
    return base;
  }

  base.document_type_code = "other";
  base.document_type_label = "その他証憑";
  base.payment_destination_code = "needs_review";
  base.payment_destination_label = "要確認";
  base.specialist_route_code = "needs_review";
  base.specialist_route_label = "人間確認";
  base.accounting_category_code = "needs_review";
  base.accounting_category_label = "要確認";
  base.payable_kind_code = "";
  base.confidence = "low";
  base.confidence_label = "低";
  base.needs_review = true;

  base.ai_summary.document_kind = "other";
  base.ai_summary.destination = "needs_review";
  base.ai_summary.payment_target = "要確認";
  base.ai_summary.payable_target = "対象外";
  base.ai_summary.expense_target = "対象外";
  base.ai_summary.tax_public = "対象外";
  base.ai_summary.public_utility = "対象外";
  base.ai_summary.contract_insurance_lease = "対象外";
  base.ai_summary.confidence_label = "低";
  base.ai_summary.reason = "OCR本文にその他証憑、書類種別未判定、確認待ち、処理先保留の記載があるため。";

  base.review_reason = base.ai_summary.reason;
  base.summary = base.summary || "その他証憑・確認待ち";

  if (!base.warnings.some(item => String(item).includes("その他証憑確認待ち補正"))) {
    base.warnings.push("その他証憑確認待ち補正: OCR本文からその他証憑・確認待ちとして判断しました。");
  }

  return base;
}
/* HD_ORIGIN_OTHER_EVIDENCE_FALLBACK_20260707_END */
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
/* HD_ORIGIN_OTHER_EVIDENCE_FALLBACK_20260707_START */
function applyPaymentDocumentOtherEvidenceFallbackFromOcr(ocrText, draft) {
  const text = String(ocrText || "");
  const compact = text.replace(/\s+/g, "");
  const base = draft && typeof draft === "object" ? { ...draft } : {};

  base.fields = base.fields && typeof base.fields === "object" ? { ...base.fields } : {};
  base.ai_summary = base.ai_summary && typeof base.ai_summary === "object" ? { ...base.ai_summary } : {};
  base.warnings = Array.isArray(base.warnings) ? [...base.warnings] : [];

  const looksOtherNeedsReview =
    /その他\s*証\s*憑|その他証憑|書類種別[:：]\s*未判定|未判定|確認待ち|処理先[:：]\s*保留|保留/.test(text) ||
    /その他証憑|書類種別未判定|内容確認待ち|処理先保留/.test(compact);

  if (!looksOtherNeedsReview) {
    return base;
  }

  base.document_type_code = "other";
  base.document_type_label = "その他証憑";
  base.payment_destination_code = "needs_review";
  base.payment_destination_label = "要確認";
  base.specialist_route_code = "needs_review";
  base.specialist_route_label = "人間確認";
  base.accounting_category_code = "needs_review";
  base.accounting_category_label = "要確認";
  base.payable_kind_code = "";
  base.confidence = "low";
  base.confidence_label = "低";
  base.needs_review = true;

  base.ai_summary.document_kind = "other";
  base.ai_summary.destination = "needs_review";
  base.ai_summary.payment_target = "要確認";
  base.ai_summary.payable_target = "対象外";
  base.ai_summary.expense_target = "対象外";
  base.ai_summary.tax_public = "対象外";
  base.ai_summary.public_utility = "対象外";
  base.ai_summary.contract_insurance_lease = "対象外";
  base.ai_summary.confidence_label = "低";
  base.ai_summary.reason = "OCR本文にその他証憑、書類種別未判定、確認待ち、処理先保留の記載があるため。";

  base.review_reason = base.ai_summary.reason;
  base.summary = base.summary || "その他証憑・確認待ち";

  if (!base.warnings.some(item => String(item).includes("その他証憑確認待ち補正"))) {
    base.warnings.push("その他証憑確認待ち補正: OCR本文からその他証憑・確認待ちとして判断しました。");
  }

  return base;
}
/* HD_ORIGIN_OTHER_EVIDENCE_FALLBACK_20260707_END */
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
  /* HD_ORIGIN_AI_PRIORITY_NO_POST_CLASSIFY_20260708
     AI重視方針:
     この関数はOCR本文ベースの後追い分類補正を行っていたため、
     AIが返した分類・登録対象を壊さないよう入力オブジェクトをそのまま返す。
     保存API・表示処理ではなく、AI後の補正だけを止める。
  */
  return value;

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
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return draft;
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
  /* HD_ORIGIN_AI_PRIORITY_NO_POST_CLASSIFY_20260708
     AI重視方針:
     この関数はOCR本文ベースの後追い分類補正を行っていたため、
     AIが返した分類・登録対象を壊さないよう入力オブジェクトをそのまま返す。
     保存API・表示処理ではなく、AI後の補正だけを止める。
  */
  return value;

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
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return draft;
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
  /* HD_ORIGIN_AI_PRIORITY_NO_POST_CLASSIFY_20260708
     AI重視方針:
     この関数はOCR本文ベースの後追い分類補正を行っていたため、
     AIが返した分類・登録対象を壊さないよう入力オブジェクトをそのまま返す。
     保存API・表示処理ではなく、AI後の補正だけを止める。
  */
  return value;

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
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return draft;
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
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return draft;
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

  const classification = normalizeAiDraftCandidate(
    classificationResponse.parsed
  );
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

  const draft = normalizeAiDraftCandidate(
    mergedRaw
  );

  draft.visible_field_labels = Array.isArray(
    draft.visible_field_labels
  )
    ? draft.visible_field_labels
    : visibleLabels;

  draft.document_group = String(
    draft.document_group || ""
  ).trim();
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

/* HD_ORIGIN_PAYMENT_DOCUMENT_SPECIALIST_AI_DECIDES_FIELDS_20260708_START */
function hdOriginAiOnlyArray(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => String(item || "").trim())
    .filter(Boolean);
}

function hdOriginAiOnlyObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function createPaymentDocumentSpecialistDraftFromOcrText(ocrText, context = {}) {
  const specialistRouteCode = String(
    context.specialist_route_code ||
    context.specialistRouteCode ||
    ""
  ).trim();

  const specialistRouteLabel = String(
    context.specialist_route_label ||
    context.specialistRouteLabel ||
    ""
  ).trim();

  const analysisSystemCode = String(
    context.analysis_system_code ||
    context.analysisSystemCode ||
    ""
  ).trim();

  const analysisSystemLabel = String(
    context.analysis_system_label ||
    context.analysisSystemLabel ||
    ""
  ).trim();

  if (!specialistRouteCode) {
    const error = new Error(
      "specialist_route_codeがありません。AI以外の推測は行いません。"
    );
    error.statusCode = 400;
    throw error;
  }

  if (!analysisSystemCode) {
    const error = new Error(
      "analysis_system_codeがありません。AI以外の推測は行いません。"
    );
    error.statusCode = 400;
    throw error;
  }

  const specialistContext = {
    phase: "specialist",
    specialist_route_code: specialistRouteCode,
    specialist_route_label: specialistRouteLabel,
    analysis_system_code: analysisSystemCode,
    analysis_system_label: analysisSystemLabel,
    group: String(context.group || "").trim(),
    draft: hdOriginAiOnlyObject(
      context.draft ||
      context.classification
    )
  };

  const prompt = appendPaymentDocumentExternalPrompt(
    [
      "あなたは支払書類の専門解析AIです。",
      "",
      "最重要:",
      "- OCR本文だけを根拠にしてください。",
      "- OCR本文にない情報は作らないでください。",
      "- HTML、後付けJS、API側で項目補正をしないため、表示する項目はAI自身が visible_field_labels で決めてください。",
      "- 必要な項目だけを返してください。",
      "- 不要項目や根拠のない空欄項目を大量に返さないでください。",
      "- 迷う場合は、値を作らず warnings または review_reason に理由を書いてください。",
      "- 必ずJSONのみを返してください。説明文、Markdown、コードフェンスは禁止です。",
      "",
      "返すJSON形式:",
      "{",
      '  "draft": {',
      '    "analysis_system_code": "",',
      '    "analysis_system_label": "",',
      '    "analysis_system_reason": "",',
      '    "analysis_system_confidence": "",',
      '    "document_group": "",',
      '    "specialist_route_code": "",',
      '    "specialist_route_label": "",',
      '    "fields": {}',
      "  },",
      '  "visible_field_labels": [],',
      '  "warnings": []',
      "}",
      "",
      "専門解析コンテキスト:",
      JSON.stringify(specialistContext, null, 2),
      "",
      "OCR本文:",
      String(ocrText || "")
    ].join("\n"),
    selectPaymentDocumentPromptFiles(specialistContext)
  );

  const response = await callPaymentDocumentOpenAiJson(
    prompt,
    loadPaymentDocumentPromptText(
      "stage3-specialist/common/system.txt",
      "OCR本文だけから専門解析JSONを作成してください。表示項目はvisible_field_labelsでAIが決めてください。必ずJSONのみを返してください。"
    )
  );

  const parsed = hdOriginAiOnlyObject(response.parsed);
  const rawDraft = hdOriginAiOnlyObject(parsed.draft || parsed.ai_draft || parsed);
  const draft = { ...rawDraft };
  const fields = hdOriginAiOnlyObject(rawDraft.fields || parsed.fields);

  draft.fields = fields;

  draft.visible_field_labels = hdOriginAiOnlyArray(
    parsed.visible_field_labels ||
    parsed.visibleFieldLabels ||
    rawDraft.visible_field_labels ||
    rawDraft.visibleFieldLabels
  );

  draft.document_group = String(
    rawDraft.document_group || ""
  ).trim();

  draft.specialist_route_code = String(
    rawDraft.specialist_route_code || ""
  ).trim();

  draft.specialist_route_label = String(
    rawDraft.specialist_route_label || ""
  ).trim();

  draft.analysis_system_code = String(
    rawDraft.analysis_system_code || ""
  ).trim();

  draft.analysis_system_label = String(
    rawDraft.analysis_system_label || ""
  ).trim();

  const requiredAiFields = [
    ["draft.document_group", draft.document_group],
    ["draft.specialist_route_code", draft.specialist_route_code],
    ["draft.specialist_route_label", draft.specialist_route_label],
    ["draft.analysis_system_code", draft.analysis_system_code],
    ["draft.analysis_system_label", draft.analysis_system_label]
  ];

  const missingAiFields = requiredAiFields
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingAiFields.length) {
    const error = new Error(
      "AI専門解析結果の必須項目が不足しています: " +
      missingAiFields.join(", ")
    );
    error.statusCode = 502;
    throw error;
  }

  if (Array.isArray(parsed.warnings) && parsed.warnings.length) {
    draft.warnings = parsed.warnings;
  }

  return {
    draft,
    classification: specialistContext.draft,
    specialist: parsed,
    document_group: draft.document_group,
    visible_field_labels: draft.visible_field_labels,
    display_mode: "ai_decides_visible_fields",
    image_used: false,
    prompt_rule_files: {
      specialist: selectPaymentDocumentPromptFiles(specialistContext)
    },
    steps: [
      {
        name: "specialist",
        usage: response.usage
      }
    ],
    ai_steps: [
      {
        name: "specialist",
        usage: response.usage
      }
    ]
  };
}
/* HD_ORIGIN_PAYMENT_DOCUMENT_SPECIALIST_AI_DECIDES_FIELDS_20260708_END */
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
    "金額・番号・口座・住所・明細の抽出は禁止です。",
    "ただし発行日だけは例外として、OCR本文と書類全体の文脈からAIが解析してください。",
    "発行日を確定できた場合は、issue_date と fields の「発行日」の両方へ同じYYYY-MM-DD形式で返してください。",
    "発行日を確定できない場合は推測せず、issue_date と fields の「発行日」を空文字にしてください。",
    "返すのは書類区分、処理先、専門解析行き先、信頼度、要確認理由に加えて、支払対象、未払登録対象、経費登録対象、税金・公的支払、公共料金・通信費、契約・保険・リースです。",
    "詳細項目抽出は禁止ですが、登録対象の候補判断は1回目仕分けで返してください。",
    "payment_target / payable_target / expense_target / tax_public / public_utility / contract_insurance_lease は ai_summary に入れてください。",
    "payable_target と expense_target は排他ではありません。両方が候補になる場合があります。",
    "payment_destination_code=expense や 処理先=経費管理 だけを理由に payable_target=対象外 にしないでください。",
    "公共料金・通信費カテゴリの業務ルールとして、電気料金・水道料金・ガス料金・通信費・インターネット料金・電話料金などの請求/通知/料金明細は、支払済み証憑として分類されない限り payable_target=候補 としてください。",
    "公共料金・通信費カテゴリでは、expense_target=候補 と payable_target=候補 は同時に成立します。",
    "公共料金・通信費カテゴリで、領収書・支払済み証憑・カード明細照合用ではない場合、payment_destination_code=expense でも payable_target=候補 としてください。",

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


/* HD_ORIGIN_SORT_TARGET_AXIS_ROOT_FIX_20260708_START
   1回目仕分けの登録対象軸の根本修正。
   payable_target と expense_target は排他ではない。
   AIが返した値を尊重し、空欄補完では payment_destination_code=expense を理由に
   payable_target=対象外 へ倒さない。
*/
function paymentDocumentSortAxisCode(value) {
  return String(value || "").trim().toLowerCase();
}

function paymentDocumentDefaultPayableTargetForSort(destinationCode, documentTypeCode, specialistRouteCode, needsReview) {
  const destination = paymentDocumentSortAxisCode(destinationCode);
  const documentType = paymentDocumentSortAxisCode(documentTypeCode);
  const route = paymentDocumentSortAxisCode(specialistRouteCode);

  if (needsReview || destination === "needs_review" || documentType === "other" || route === "needs_review") {
    return "要確認";
  }

  if (
    destination === "evidence_only" ||
    destination === "no_process" ||
    route === "reference_check" ||
    documentType === "receipt" ||
    documentType === "paid_evidence" ||
    route === "paid_evidence" ||
    destination === "card_payable" ||
    documentType === "card_statement" ||
    route === "card_statement"
  ) {
    return "対象外";
  }

  if (
    destination === "accounts_payable" ||
    destination === "payable" ||
    destination === "unpaid"
  ) {
    return "候補";
  }

  /* HD_ORIGIN_UTILITY_COMM_PAYABLE_CATEGORY_RULE_20260708
     公共料金・通信費カテゴリは、支払済み証憑として分類されていない限り、
     経費管理と未払登録候補が同時成立する。
     ここはAI値が空欄だった場合の中立補完であり、AIが明示した対象外を上書きしない。
  */
  if (
    documentType === "utility_notice" ||
    documentType === "public_utility_notice" ||
    documentType === "communication_notice" ||
    documentType === "telecom_notice" ||
    documentType === "internet_notice" ||
    documentType === "phone_notice" ||
    route === "utility" ||
    route === "public_utility" ||
    route === "communication" ||
    route === "telecom" ||
    route === "mail_comm" ||
    route === "mail_communication"
  ) {
    return "候補";
  }

  if (destination === "expense") {
    return "要確認";
  }

  if (destination === "tax_public" || destination === "contract_insurance_lease") {
    return "要確認";
  }

  return "要確認";
}

function paymentDocumentDefaultExpenseTargetForSort(destinationCode, documentTypeCode, specialistRouteCode, needsReview) {
  const destination = paymentDocumentSortAxisCode(destinationCode);
  const documentType = paymentDocumentSortAxisCode(documentTypeCode);
  const route = paymentDocumentSortAxisCode(specialistRouteCode);

  if (needsReview || destination === "needs_review" || documentType === "other" || route === "needs_review") {
    return "要確認";
  }

  if (destination === "expense") {
    return "候補";
  }

  if (
    destination === "evidence_only" ||
    destination === "no_process" ||
    destination === "card_payable" ||
    destination === "tax_public" ||
    destination === "accounts_payable" ||
    destination === "payable" ||
    destination === "unpaid" ||
    destination === "contract_insurance_lease" ||
    documentType === "receipt" ||
    documentType === "paid_evidence" ||
    documentType === "card_statement" ||
    route === "card_statement" ||
    route === "reference_check"
  ) {
    return "対象外";
  }

  return "要確認";
}
/* HD_ORIGIN_SORT_TARGET_AXIS_ROOT_FIX_20260708_END */

/* HD_ORIGIN_NO_POST_ANALYSIS_SYSTEM_FIX_GPT00_20260709: analysis_system_* の後付け推測補完ブロックを撤去。AI返却値・人間修正値のみ扱う。 */
/* HD_ORIGIN_BASIC_ANALYSIS_ROUTES_AI_ONLY_20260711_START */
function normalizePaymentDocumentSortCandidate(value) {
  const raw = value && typeof value === "object" ? value : {};
  const source =
    raw.draft && typeof raw.draft === "object" ? raw.draft :
    raw.sorting && typeof raw.sorting === "object" ? raw.sorting :
    raw.classification && typeof raw.classification === "object" ? raw.classification :
    raw;

  const aiSummary =
    source.ai_summary && typeof source.ai_summary === "object" ? source.ai_summary :
    source.aiSummary && typeof source.aiSummary === "object" ? source.aiSummary :
    raw.ai_summary && typeof raw.ai_summary === "object" ? raw.ai_summary :
    raw.aiSummary && typeof raw.aiSummary === "object" ? raw.aiSummary :
    {};

  const fields = source.fields && typeof source.fields === "object" ? source.fields : {};

  function firstText() {
    for (const value of arguments) {
      const text = paymentDocumentSortText(value);
      if (text) return text;
    }

    return "";
  }

  function normalizeConfidence(rawConfidence, rawLabel) {
    let confidence = paymentDocumentSortText(rawConfidence || "").toLowerCase();
    let label = paymentDocumentSortText(rawLabel || "");

    if (confidence === "高") confidence = "high";
    if (confidence === "中") confidence = "medium";
    if (confidence === "低") confidence = "low";

    if (label === "high") label = "高";
    if (label === "medium") label = "中";
    if (label === "low") label = "低";

    if (!["high", "medium", "low"].includes(confidence)) {
      if (label === "高") confidence = "high";
      else if (label === "低") confidence = "low";
      else confidence = "medium";
    }

    if (!label) {
      label = confidence === "high" ? "高" : confidence === "low" ? "低" : "中";
    }

    return { confidence, label };
  }

  const accountingCategoryCode = firstText(
    source.accounting_category_code,
    source.accountingCategoryCode,
    aiSummary.accounting_category_code,
    aiSummary.accountingCategoryCode
  );

  const accountingCategoryLabel = firstText(
    source.accounting_category_label,
    source.accountingCategoryLabel,
    source.accounting_category_name,
    aiSummary.accounting_category_label,
    aiSummary.accountingCategoryLabel,
    aiSummary.accounting_category,
    aiSummary.accountingCategory,
    fields["会計区分"]
  );

  const paymentDestinationCode = firstText(
    source.payment_destination_code,
    source.paymentDestinationCode,
    aiSummary.payment_destination_code,
    aiSummary.paymentDestinationCode,
    aiSummary.destination_code,
    aiSummary.destinationCode
  );

  const paymentDestinationLabel = firstText(
    source.payment_destination_label,
    source.paymentDestinationLabel,
    source.payment_destination_name,
    aiSummary.payment_destination_label,
    aiSummary.paymentDestinationLabel,
    aiSummary.destination_label,
    aiSummary.destinationLabel,
    aiSummary.destination,
    fields["処理先"]
  );

  const issueDate = firstText(
    source.issue_date,
    source.issueDate,
    aiSummary.issue_date,
    aiSummary.issueDate,
    fields["発行日"]
  );

  const analysisSystemCode = firstText(
    source.analysis_system_code,
    source.analysisSystemCode,
    aiSummary.analysis_system_code,
    aiSummary.analysisSystemCode,
    source.specialist_route_code
  );

  const analysisSystemLabel = firstText(
    source.analysis_system_label,
    source.analysisSystemLabel,
    aiSummary.analysis_system_label,
    aiSummary.analysisSystemLabel,
    aiSummary.analysis_system,
    aiSummary.analysisSystem,
    source.specialist_route_label
  );

  const analysisSystemReason = firstText(
    source.analysis_system_reason,
    source.analysisSystemReason,
    aiSummary.analysis_system_reason,
    aiSummary.analysisSystemReason
  );

  const analysisSystemConfidence = firstText(
    source.analysis_system_confidence,
    source.analysisSystemConfidence,
    aiSummary.analysis_system_confidence,
    aiSummary.analysisSystemConfidence
  );

  const confidenceInfo = normalizeConfidence(
    firstText(source.ai_confidence, source.confidence, source.confidence_level, aiSummary.ai_confidence),
    firstText(source.ai_confidence_label, source.confidence_label, aiSummary.ai_confidence_label, aiSummary.confidence_label, fields["信頼度"])
  );

  const aiReason = firstText(
    source.ai_reason,
    source.reason,
    source.review_reason,
    aiSummary.reason,
    fields["理由"]
  );

  const needsReview =
    source.needs_review === true ||
    source.needsReview === true ||
    confidenceInfo.confidence === "low" ||
    analysisSystemCode === "needs_review" ||
    paymentDestinationCode === "needs_review" ||
    accountingCategoryCode === "needs_review";

  const warnings = Array.isArray(source.warnings)
    ? source.warnings
    : Array.isArray(raw.warnings)
      ? raw.warnings
      : [];

  const visibleFieldLabels = ["会計区分", "専門解析先", "発行日", "信頼度", "理由"];

  return {
    accounting_category_code: accountingCategoryCode,
    accounting_category_label: accountingCategoryLabel,
    payment_destination_code: paymentDestinationCode,
    payment_destination_label: paymentDestinationLabel,
    issue_date: issueDate,

    ai_confidence: confidenceInfo.confidence,
    ai_confidence_label: confidenceInfo.label,
    confidence: confidenceInfo.confidence,
    confidence_label: confidenceInfo.label,
    ai_reason: aiReason,
    review_reason: aiReason,

    analysis_system_code: analysisSystemCode,
    analysis_system_label: analysisSystemLabel,
    analysis_system_reason: analysisSystemReason,
    analysis_system_confidence: analysisSystemConfidence,

    needs_review: needsReview,
    warnings,
    visible_field_labels: visibleFieldLabels,

    fields: {
      "会計区分": accountingCategoryLabel || accountingCategoryCode,
      "専門解析先": analysisSystemLabel || analysisSystemCode,
      "発行日": issueDate,
      "信頼度": confidenceInfo.label,
      "理由": aiReason
    },

    ai_summary: {
      accounting_category: accountingCategoryLabel || accountingCategoryCode,
      accounting_category_code: accountingCategoryCode,
      accounting_category_label: accountingCategoryLabel,
      destination: paymentDestinationLabel || paymentDestinationCode,
      payment_destination_code: paymentDestinationCode,
      payment_destination_label: paymentDestinationLabel,
      issue_date: issueDate,
      confidence_label: confidenceInfo.label,
      reason: aiReason,
      analysis_system_code: analysisSystemCode,
      analysis_system: analysisSystemLabel,
      analysis_system_label: analysisSystemLabel,
      analysis_system_reason: analysisSystemReason,
      analysis_system_confidence: analysisSystemConfidence
    }
  };
}
/* HD_ORIGIN_BASIC_ANALYSIS_ROUTES_AI_ONLY_20260711_END */

/* HD_ORIGIN_BASIC_ANALYSIS_ROUTES_AI_ONLY_20260711_START */
function applyPaymentDocumentSortRuleFallbackFromOcr(ocrText, draft) {
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return draft;
  /*
    基礎解析ではOCR本文の固定語句による後付け分類を禁止する。
    この関数は旧フォールバック互換名だけ残し、AI返却値の基礎解析正規化だけ行う。
  */
  return normalizePaymentDocumentSortCandidate(draft);
}
/* HD_ORIGIN_BASIC_ANALYSIS_ROUTES_AI_ONLY_20260711_END */

async function createPaymentDocumentSortFromOcrText(ocrText) {
  const prompt = buildPaymentDocumentSortPrompt(ocrText);

  const response = await callPaymentDocumentOpenAiJson(
    prompt,
    loadPaymentDocumentPromptText(
      "sorting.system.txt",
      "OCR本文だけから支払書類の1回目仕分けJSONを作成してください。詳細項目は抽出せず、必ずJSONのみを返してください。"
    )
  );

  const draft = normalizePaymentDocumentSortCandidate(response.parsed);

  return {
    draft,
    classification: draft,
    sorting: draft,
    document_group: draft.analysis_system_code || draft.analysis_system_label || "",
    visible_field_labels: draft.visible_field_labels || ["会計区分", "専門解析先", "発行日", "信頼度", "理由"],
    display_mode: "sorting_only",
    image_used: false,
    prompt_rule_files: {
      sorting: ["sorting.system.txt"]
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
  /* HD_ORIGIN_AI_PRIORITY_NO_POST_CLASSIFY_20260708
     AI重視方針:
     この関数はOCR本文ベースの後追い分類補正を行っていたため、
     AIが返した分類・登録対象を壊さないよう入力オブジェクトをそのまま返す。
     保存API・表示処理ではなく、AI後の補正だけを止める。
  */
  return value;

  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hdOriginSortGrowHasAny(text, words) {
  const s = String(text || "").replace(/\s+/g, "").toLowerCase();
  return words.some(word => s.includes(String(word || "").replace(/\s+/g, "").toLowerCase()));
}

/* HD_ORIGIN_BASIC_ANALYSIS_ROUTES_AI_ONLY_20260711_START */
function hdOriginPolishPaymentDocumentSortResult(sortResult, ocrText) {
  /*
    基礎解析ではAI結果をOCR本文の固定分類で上書きしない。
    ここでは、AI返却JSONを基礎解析形式へ揃えるだけにする。
  */
  const result = sortResult && typeof sortResult === "object" ? { ...sortResult } : {};
  const draft = normalizePaymentDocumentSortCandidate(
    result.draft ||
    result.sorting ||
    result.classification ||
    result
  );

  result.draft = draft;
  result.classification = draft;
  result.sorting = draft;
  result.document_group = draft.analysis_system_code || draft.analysis_system_label || "";
  result.visible_field_labels = draft.visible_field_labels;
  result.display_mode = result.display_mode || "sorting_only";
  result.image_used = false;

  return result;
}
/* HD_ORIGIN_BASIC_ANALYSIS_ROUTES_AI_ONLY_20260711_END */
/* PAYMENT_DOCUMENT_SORT_GROW_POLISH_20260707_END */
/* PAYMENT_DOCUMENT_SORT_GROW_CARD_POLISH_20260707_START */
function hdOriginCardSortGrowText(value) {
  /* HD_ORIGIN_AI_PRIORITY_NO_POST_CLASSIFY_20260708
     AI重視方針:
     この関数はOCR本文ベースの後追い分類補正を行っていたため、
     AIが返した分類・登録対象を壊さないよう入力オブジェクトをそのまま返す。
     保存API・表示処理ではなく、AI後の補正だけを止める。
  */
  return value;

  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hdOriginCardSortGrowHasAny(text, words) {
  const s = String(text || "").replace(/\s+/g, "").toLowerCase();
  return words.some(word => s.includes(String(word || "").replace(/\s+/g, "").toLowerCase()));
}

function hdOriginPolishPaymentDocumentCardSortResult(sortResult, ocrText) {
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return sortResult &&
    typeof sortResult === "object"
      ? sortResult
      : {};
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
    draft.ai_summary.payable_target = draft.ai_summary.payable_target || "候補";
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
  /* HD_ORIGIN_AI_PRIORITY_NO_POST_CLASSIFY_20260708
     AI重視方針:
     この関数はOCR本文ベースの後追い分類補正を行っていたため、
     AIが返した分類・登録対象を壊さないよう入力オブジェクトをそのまま返す。
     保存API・表示処理ではなく、AI後の補正だけを止める。
  */
  return value;

  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hdOriginMailCommSortHasAny(text, words) {
  const s = String(text || "").replace(/\s+/g, "").toLowerCase();
  return words.some(word => s.includes(String(word || "").replace(/\s+/g, "").toLowerCase()));
}

function hdOriginPolishPaymentDocumentMailCommSortResult(sortResult, ocrText) {
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return sortResult &&
    typeof sortResult === "object"
      ? sortResult
      : {};
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

    draft.specialist_route_code = "utility";
    draft.specialist_route_label = "公共料金・通信費確認";
    draft.source_type_code = "scan_upload";

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
    draft.ai_summary.payable_target = draft.ai_summary.payable_target || "候補";
    draft.ai_summary.expense_target = "候補";
    draft.ai_summary.tax_public = "対象外";
    draft.ai_summary.public_utility = "公共料金";
    draft.ai_summary.contract_insurance_lease = "対象外";
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
  /* HD_ORIGIN_AI_PRIORITY_NO_POST_CLASSIFY_20260708
     AI重視方針:
     この関数はOCR本文ベースの後追い分類補正を行っていたため、
     AIが返した分類・登録対象を壊さないよう入力オブジェクトをそのまま返す。
     保存API・表示処理ではなく、AI後の補正だけを止める。
  */
  return value;

  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hdOriginReceiptAttentionSortHasAny(text, words) {
  const s = String(text || "").replace(/\s+/g, "").toLowerCase();
  return words.some(word => s.includes(String(word || "").replace(/\s+/g, "").toLowerCase()));
}

function hdOriginPolishPaymentDocumentReceiptAttentionSortResult(sortResult, ocrText) {
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return sortResult &&
    typeof sortResult === "object"
      ? sortResult
      : {};
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
    draft.ai_summary.payable_target = draft.ai_summary.payable_target || "候補";
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
/* PAYMENT_DOCUMENT_SORT_GROW_MATERIAL_INVOICE_POLISH_20260707_START */
function hdOriginMaterialInvoiceSortText(value) {
  /* HD_ORIGIN_AI_PRIORITY_NO_POST_CLASSIFY_20260708
     AI重視方針:
     この関数はOCR本文ベースの後追い分類補正を行っていたため、
     AIが返した分類・登録対象を壊さないよう入力オブジェクトをそのまま返す。
     保存API・表示処理ではなく、AI後の補正だけを止める。
  */
  return value;

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
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return sortResult &&
    typeof sortResult === "object"
      ? sortResult
      : {};
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
  /* HD_ORIGIN_AI_PRIORITY_NO_POST_CLASSIFY_20260708
     AI重視方針:
     この関数はOCR本文ベースの後追い分類補正を行っていたため、
     AIが返した分類・登録対象を壊さないよう入力オブジェクトをそのまま返す。
     保存API・表示処理ではなく、AI後の補正だけを止める。
  */
  return value;

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
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return sortResult &&
    typeof sortResult === "object"
      ? sortResult
      : {};
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
    draft.source_type_code = "scan_upload";

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
    draft.ai_summary.public_utility = "対象外";
    draft.ai_summary.contract_insurance_lease = "保険";
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
/* PAYMENT_DOCUMENT_SORT_GROW_LEASE_POLISH_20260707_START */
function hdOriginLeaseSortText(value) {
  /* HD_ORIGIN_AI_PRIORITY_NO_POST_CLASSIFY_20260708
     AI重視方針:
     この関数はOCR本文ベースの後追い分類補正を行っていたため、
     AIが返した分類・登録対象を壊さないよう入力オブジェクトをそのまま返す。
     保存API・表示処理ではなく、AI後の補正だけを止める。
  */
  return value;

  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hdOriginLeaseSortNormalize(text) {
  return String(text || "").replace(/\s+/g, "").toLowerCase();
}

function hdOriginLeaseSortHasAny(text, words) {
  const s = hdOriginLeaseSortNormalize(text);
  return words.some(word => s.includes(String(word || "").replace(/\s+/g, "").toLowerCase()));
}

function hdOriginPolishPaymentDocumentLeaseSortResult(sortResult, ocrText) {
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return sortResult &&
    typeof sortResult === "object"
      ? sortResult
      : {};
  const result = sortResult && typeof sortResult === "object" ? { ...sortResult } : {};
  const draft = result.draft && typeof result.draft === "object" ? { ...result.draft } : {};
  const text = String(ocrText || "");

  draft.fields = {};

  const isPublicTax = hdOriginLeaseSortHasAny(text, [
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

  const isLeaseContract =
    !isPublicTax &&
    (
      hdOriginLeaseSortHasAny(text, ["リース契約書", "リース契約"]) ||
      (
        hdOriginLeaseSortHasAny(text, ["リース"]) &&
        hdOriginLeaseSortHasAny(text, ["貸主", "借主", "契約期間", "月額リース料", "毎月末日", "支払日"])
      )
    );

  if (isLeaseContract) {
    draft.document_type_code = "lease_contract";
    draft.document_type_label = "リース契約書";
    draft.document_type_name = "リース契約書";

    draft.payment_destination_code = "contract_insurance_lease";
    draft.payment_destination_label = "契約・保険・リース";
    draft.payment_destination_name = "契約・保険・リース";

    draft.specialist_route_code = "contract_insurance_lease";
    draft.specialist_route_label = "契約・保険・リース確認";
    draft.source_type_code = "scan_upload";

    draft.accounting_category_code = "lease";
    draft.accounting_category_label = "リース";
    draft.accounting_category_name = "リース";

    draft.payable_kind_code = "unpaid";
    draft.payable_kind_label = "未払金";
    draft.payable_kind_name = "未払金";

    draft.confidence = "high";
    draft.confidence_level = "high";
    draft.confidence_label = "高";
    draft.ai_confidence = "高";

    draft.needs_review = false;
    draft.review_reason = "リース契約書であり、貸主・借主・契約期間・月額リース料・支払日の記載があるため。買掛ではなく契約・リース系の未払金候補として扱う。";

    draft.ai_summary = draft.ai_summary && typeof draft.ai_summary === "object" ? { ...draft.ai_summary } : {};
    draft.ai_summary.document_kind = "リース契約書";
    draft.ai_summary.destination = "契約・保険・リース";
    draft.ai_summary.payment_target = "支払対象候補";
    draft.ai_summary.payable_target = "候補";
    draft.ai_summary.expense_target = "対象外";
    draft.ai_summary.tax_public = "対象外";
    draft.ai_summary.public_utility = "対象外";
    draft.ai_summary.contract_insurance_lease = "リース";
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
/* PAYMENT_DOCUMENT_SORT_GROW_LEASE_POLISH_20260707_END */
/* PAYMENT_DOCUMENT_SORT_GROW_UTILITY_POLISH_20260707_START */
function hdOriginUtilitySortText(value) {
  /* HD_ORIGIN_AI_PRIORITY_NO_POST_CLASSIFY_20260708
     AI重視方針:
     この関数はOCR本文ベースの後追い分類補正を行っていたため、
     AIが返した分類・登録対象を壊さないよう入力オブジェクトをそのまま返す。
     保存API・表示処理ではなく、AI後の補正だけを止める。
  */
  return value;

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

function hdOriginDetectUtilityKindForReason(ocrText) {
  const text = String(ocrText || "");

  if (hdOriginUtilitySortHasAny(text, ["水道料金通知書", "水道料金", "水道局", "水道"])) {
    return {
      label: "水道料金通知書",
      reason: "水道料金通知書であり、水道局・対象期間・支払期限・請求合計の記載があるため。税金ではなく公共料金として扱う。"
    };
  }

  if (hdOriginUtilitySortHasAny(text, ["電気料金", "電力"])) {
    return {
      label: "電気料金Web明細",
      reason: "電気料金のWeb明細であり、発行元・契約名義・対象月・請求合計の記載があるため。税金ではなく公共料金として扱う。"
    };
  }

  if (hdOriginUtilitySortHasAny(text, ["ガス料金", "ガス会社"])) {
    return {
      label: "ガス料金通知書",
      reason: "ガス料金通知書であり、発行元・対象期間・支払期限・請求合計の記載があるため。税金ではなく公共料金として扱う。"
    };
  }

  if (hdOriginUtilitySortHasAny(text, ["通信費", "通信費のお知らせ", "電話料金", "インターネット料金", "クラウド利用料"])) {
    return {
      label: "通信費通知書",
      reason: "通信費系の通知書であり、対象月・請求額・支払方法等の記載があるため。税金ではなく通信費系の経費として扱う。"
    };
  }

  return {
    label: "公共料金通知書",
    reason: "公共料金の通知書であり、料金種別・対象期間または使用期間・請求合計の記載があるため。税金ではなく公共料金として扱う。"
  };
}

function hdOriginPolishPaymentDocumentUtilitySortResult(sortResult, ocrText) {
  /* HD_ORIGIN_AI_ONLY_NO_POST_JUDGMENT_20260716 */
  return sortResult &&
    typeof sortResult === "object"
      ? sortResult
      : {};
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
    "水道料金通知書",
    "水道局",
    "水道",
    "通信費",
    "電話料金",
    "インターネット料金",
    "クラウド利用料",
    "電力",
    "ガス会社"
  ]);

  const utilityContextCount = hdOriginUtilitySortCountAny(text, [
    "web明細",
    "ｗｅｂ明細",
    "web 明細",
    "対象月",
    "対象期間",
    "使用期間",
    "使用者",
    "契約名義",
    "通知日",
    "支払期限",
    "請求日",
    "請求合計",
    "消費税相当額",
    "発行元",
    "処理先:経費へ",
    "処理先：経費へ"
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
    const utilityKind = hdOriginDetectUtilityKindForReason(text);

    draft.document_type_code = "utility_notice";
    draft.document_type_label = "公共料金通知書";
    draft.document_type_name = "公共料金通知書";

    draft.payment_destination_code = "expense";
    draft.payment_destination_label = "経費管理";
    draft.payment_destination_name = "経費管理";

    draft.specialist_route_code = "utility";
    draft.specialist_route_label = "公共料金・通信費確認";
    draft.source_type_code = "scan_upload";

    draft.accounting_category_code = "public_utility";
    draft.accounting_category_label = "公共料金";
    draft.accounting_category_name = "公共料金";
    draft.payable_kind_code = "";

    draft.confidence = "high";
    draft.confidence_level = "high";
    draft.confidence_label = "高";
    draft.ai_confidence = "高";

    draft.needs_review = false;
    draft.review_reason = utilityKind.reason;

    draft.ai_summary = draft.ai_summary && typeof draft.ai_summary === "object" ? { ...draft.ai_summary } : {};
    draft.ai_summary.document_kind = "公共料金通知書";
    draft.ai_summary.destination = "経費管理";
    draft.ai_summary.payment_target = "支払対象候補";
    draft.ai_summary.payable_target = draft.ai_summary.payable_target || "候補";
    draft.ai_summary.expense_target = "候補";
    draft.ai_summary.tax_public = "対象外";
    draft.ai_summary.public_utility = "公共料金";
    draft.ai_summary.contract_insurance_lease = "対象外";
    draft.ai_summary.card_statement = "対象外";
    draft.ai_summary.confidence_label = "高";
    draft.ai_summary.reason = draft.review_reason;
    draft.ai_summary.utility_kind = utilityKind.label;
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
/* HD_ORIGIN_PAYMENT_DOCUMENT_SORTING_DRAFT_SAVE_API_20260707_START */
function hdOriginSortingDraftText(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value).trim();
}

function hdOriginSortingDraftFirstObject(...items) {
  for (const item of items) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return item;
    }
  }

  return {};
}

function hdOriginSortingDraftNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hdOriginSortingDraftRotation(value) {
  const n = Number(value || 0);

  if (![0, 90, 180, 270].includes(n)) {
    return 0;
  }

  return n;
}

function hdOriginSortingDraftJson(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }

  return value;
}

function hdOriginBuildSortingDraftSavePayload(body, ocrRow) {
  const root =
    hdOriginSortingDraftFirstObject(
      body.sortResult,
      body.sort_result,
      body.sorting,
      body.classification,
      body.draft,
      body.aiDraft,
      body
    );

  const draft = hdOriginSortingDraftFirstObject(
    body.draft,
    body.aiDraft,
    body.sorting,
    body.classification,
    root.draft,
    root.sorting,
    root.classification,
    root
  );

  const aiSummary = hdOriginSortingDraftFirstObject(
    body.ai_summary,
    body.aiSummary,
    draft.ai_summary,
    draft.aiSummary,
    root.ai_summary,
    root.aiSummary
  );

  const visibleFields = hdOriginSortingDraftJson(
    body.visibleFields || body.visible_fields || body.fields || draft.fields || {},
    {}
  );

  const warnings = Array.isArray(body.warnings)
    ? body.warnings
    : Array.isArray(draft.warnings)
      ? draft.warnings
      : Array.isArray(root.warnings)
        ? root.warnings
        : [];

  const now = new Date();
  const z = n => String(n).padStart(2, "0");
  const draftNo =
    "PDSD-" +
    String(ocrRow.payment_document_ocr_import_id) +
    "-" +
    String(now.getFullYear()) +
    z(now.getMonth() + 1) +
    z(now.getDate()) +
    z(now.getHours()) +
    z(now.getMinutes()) +
    z(now.getSeconds());

  return {
    issue_date: (() => {
      const value =
        body.issue_date ??
        body.issueDate ??
        draft.issue_date ??
        draft.issueDate ??
        aiSummary.issue_date ??
        aiSummary.issueDate ??
        null;
      if (value === null || value === undefined || value === "") return null;
      const matched = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
      return matched ? matched[1] : null;
    })(),
    payment_document_ocr_import_id: Number(ocrRow.payment_document_ocr_import_id),
    draft_no: hdOriginSortingDraftText(body.draftNo || body.draft_no || draftNo),
    draft_status: hdOriginSortingDraftText(body.draftStatus || body.draft_status || "draft_saved"),
    human_check_status: hdOriginSortingDraftText(body.humanCheckStatus || body.human_check_status || "unchecked"),

    document_type_id: hdOriginSortingDraftNumberOrNull(body.documentTypeId || body.document_type_id || draft.document_type_id),
    document_type_code: hdOriginSortingDraftText(body.documentTypeCode || body.document_type_code || draft.document_type_code || draft.document_kind || aiSummary.document_kind),
    document_type_label: hdOriginSortingDraftText(body.documentTypeLabel || body.document_type_label || draft.document_type_label || draft.document_kind_label || aiSummary.document_kind_label),

    payment_destination_id: hdOriginSortingDraftNumberOrNull(body.paymentDestinationId || body.payment_destination_id || draft.payment_destination_id),
    payment_destination_code: hdOriginSortingDraftText(body.paymentDestinationCode || body.payment_destination_code || draft.payment_destination_code || aiSummary.destination),
    payment_destination_label: hdOriginSortingDraftText(body.paymentDestinationLabel || body.payment_destination_label || draft.payment_destination_label || aiSummary.destination_label),

    accounting_category_id: hdOriginSortingDraftNumberOrNull(body.accountingCategoryId || body.accounting_category_id || draft.accounting_category_id),
    accounting_category_code: hdOriginSortingDraftText(body.accountingCategoryCode || body.accounting_category_code || draft.accounting_category_code),
    accounting_category_label: hdOriginSortingDraftText(body.accountingCategoryLabel || body.accounting_category_label || draft.accounting_category_label),

    payable_kind_id: hdOriginSortingDraftNumberOrNull(body.payableKindId || body.payable_kind_id || draft.payable_kind_id),
    payable_kind_code: hdOriginSortingDraftText(body.payableKindCode || body.payable_kind_code || draft.payable_kind_code),
    payable_kind_label: hdOriginSortingDraftText(body.payableKindLabel || body.payable_kind_label || draft.payable_kind_label),

    specialist_route_code: hdOriginSortingDraftText(body.specialistRouteCode || body.specialist_route_code || draft.specialist_route_code || root.document_group),
    specialist_route_label: hdOriginSortingDraftText(body.specialistRouteLabel || body.specialist_route_label || draft.specialist_route_label),

    analysis_system_code: hdOriginSortingDraftText(body.analysisSystemCode || body.analysis_system_code || draft.analysis_system_code || root.analysis_system_code || aiSummary.analysis_system_code),
    analysis_system_label: hdOriginSortingDraftText(body.analysisSystemLabel || body.analysis_system_label || draft.analysis_system_label || root.analysis_system_label || aiSummary.analysis_system_label || aiSummary.analysis_system),
    analysis_system_reason: hdOriginSortingDraftText(body.analysisSystemReason || body.analysis_system_reason || draft.analysis_system_reason || root.analysis_system_reason || aiSummary.analysis_system_reason),
    analysis_system_confidence: hdOriginSortingDraftText(body.analysisSystemConfidence || body.analysis_system_confidence || draft.analysis_system_confidence || root.analysis_system_confidence || aiSummary.analysis_system_confidence),

    payment_target_label: hdOriginSortingDraftText(body.paymentTargetLabel || body.payment_target_label || aiSummary.payment_target),
    payable_target_label: hdOriginSortingDraftText(body.payableTargetLabel || body.payable_target_label || aiSummary.payable_target),
    expense_target_label: hdOriginSortingDraftText(body.expenseTargetLabel || body.expense_target_label || aiSummary.expense_target),
    tax_public_label: hdOriginSortingDraftText(body.taxPublicLabel || body.tax_public_label || aiSummary.tax_public),
    public_utility_label: hdOriginSortingDraftText(body.publicUtilityLabel || body.public_utility_label || aiSummary.public_utility),
    contract_insurance_lease_label: hdOriginSortingDraftText(body.contractInsuranceLeaseLabel || body.contract_insurance_lease_label || aiSummary.contract_insurance_lease),

    ai_confidence: hdOriginSortingDraftText(body.aiConfidence || body.ai_confidence || draft.ai_confidence || draft.confidence),
    ai_confidence_label: hdOriginSortingDraftText(body.aiConfidenceLabel || body.ai_confidence_label || draft.ai_confidence_label || draft.confidence_label || aiSummary.confidence_label),
    ai_reason: hdOriginSortingDraftText(body.aiReason || body.ai_reason || draft.ai_reason || draft.reason || aiSummary.reason),
    review_reason: hdOriginSortingDraftText(body.reviewReason || body.review_reason || draft.review_reason || root.review_reason || aiSummary.reason),
    needs_review: !!(body.needsReview || body.needs_review || draft.needs_review || root.needs_review),

    ai_summary_json: aiSummary,
    sort_result_json: hdOriginSortingDraftJson(body.sortResult || body.sort_result || body.sorting || root, {}),
    visible_fields_json: visibleFields,
    human_corrections_json: hdOriginSortingDraftJson(body.humanCorrections || body.human_corrections || {}, {}),
    warnings_json: warnings,

    original_file_name: hdOriginSortingDraftText(ocrRow.original_file_name || body.originalFileName || body.original_file_name),
    saved_file_name: hdOriginSortingDraftText(ocrRow.saved_file_name || body.savedFileName || body.saved_file_name),
    saved_relative_path: hdOriginSortingDraftText(ocrRow.saved_relative_path || body.savedRelativePath || body.saved_relative_path),
    sha256: hdOriginSortingDraftText(ocrRow.sha256 || body.sha256),
    ocr_text_length: Number(ocrRow.ocr_text_length || body.ocrTextLength || body.ocr_text_length || 0),

    display_rotation: hdOriginSortingDraftRotation(body.displayRotation || body.display_rotation),

    memo: hdOriginSortingDraftText(body.memo),
    created_by_page: hdOriginSortingDraftText(body.createdByPage || body.created_by_page || "payment-document-review"),
    created_by: hdOriginSortingDraftText(body.createdBy || body.created_by),
    updated_by: hdOriginSortingDraftText(body.updatedBy || body.updated_by)
  };
}

async function hdOriginSavePaymentDocumentSortingDraft(body) {
  const id = Number(
    body.paymentDocumentOcrImportId ||
    body.payment_document_ocr_import_id ||
    body.selectedOcrImportId ||
    body.ocrImportId ||
    body.id
  );

  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("OCR取込IDが不正です。");
    err.statusCode = 400;
    throw err;
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const ocrResult = await client.query(`
    SELECT
      payment_document_ocr_import_id,
      original_file_name,
      saved_file_name,
      saved_relative_path,
      sha256,
      ocr_text_length
    FROM accounting.payment_document_ocr_imports
    WHERE payment_document_ocr_import_id = $1
      AND deleted_at IS NULL
    LIMIT 1
    FOR UPDATE
  `, [id]);

  const ocrRow = ocrResult.rows[0];

  if (!ocrRow) {
    const err = new Error("OCR取込データが見つかりません。");
    err.statusCode = 404;
    throw err;
  }

  const payload = hdOriginBuildSortingDraftSavePayload(body, ocrRow);

    await client.query(`
      UPDATE accounting.payment_document_sorting_drafts
      SET
        is_current = FALSE,
        updated_by = $2
      WHERE payment_document_ocr_import_id = $1
        AND is_current = TRUE
        AND deleted_at IS NULL
    `, [
      payload.payment_document_ocr_import_id,
      payload.updated_by
    ]);

    const result = await client.query(`
    WITH inserted AS (
      INSERT INTO accounting.payment_document_sorting_drafts (
        payment_document_ocr_import_id,
        draft_no,
        draft_status,
        human_check_status,

        document_type_id,
        document_type_code,
        document_type_label,

        payment_destination_id,
        payment_destination_code,
        payment_destination_label,

        accounting_category_id,
        accounting_category_code,
        accounting_category_label,

        payable_kind_id,
        payable_kind_code,
        payable_kind_label,

        specialist_route_code,
        specialist_route_label,

        analysis_system_code,
        analysis_system_label,
        analysis_system_reason,
        analysis_system_confidence,

        payment_target_label,
        payable_target_label,
        expense_target_label,
        tax_public_label,
        public_utility_label,
        contract_insurance_lease_label,

        ai_confidence,
        ai_confidence_label,
        ai_reason,
        review_reason,
        needs_review,

        ai_summary_json,
        sort_result_json,
        visible_fields_json,
        human_corrections_json,
        warnings_json,

        original_file_name,
        saved_file_name,
        saved_relative_path,
        sha256,
        ocr_text_length,

        display_rotation,
        memo,
        created_by_page,
        created_by,
        updated_by,
        issue_date
      ) VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,
        $8,$9,$10,
        $11,$12,$13,
        $14,$15,$16,
        $17,$18,
        $19,$20,$21,$22,
        $23,$24,$25,$26,$27,$28,
        $29,$30,$31,$32,$33,
        $34::jsonb,$35::jsonb,$36::jsonb,$37::jsonb,$38::jsonb,
        $39,$40,$41,$42,$43,
        $44,$45,$46,$47,$48,
        $49::date
      )
      RETURNING
        payment_document_sorting_draft_id,
        draft_no,
        draft_status,
        created_at,
        issue_date
    )
    UPDATE accounting.payment_document_ocr_imports o
    SET
      draft_status = 'draft_saved',
      latest_sorting_draft_id = inserted.payment_document_sorting_draft_id,
      sorted_at = now()
    FROM inserted
    WHERE o.payment_document_ocr_import_id = $1
    RETURNING
      inserted.payment_document_sorting_draft_id,
      inserted.draft_no,
      inserted.draft_status,
      inserted.created_at,
      inserted.issue_date,
      o.payment_document_ocr_import_id,
      o.latest_sorting_draft_id,
      o.sorted_at
  `, [
    payload.payment_document_ocr_import_id,
    payload.draft_no,
    payload.draft_status,
    payload.human_check_status,

    payload.document_type_id,
    payload.document_type_code,
    payload.document_type_label,

    payload.payment_destination_id,
    payload.payment_destination_code,
    payload.payment_destination_label,

    payload.accounting_category_id,
    payload.accounting_category_code,
    payload.accounting_category_label,

    payload.payable_kind_id,
    payload.payable_kind_code,
    payload.payable_kind_label,

    payload.specialist_route_code,
    payload.specialist_route_label,

    payload.analysis_system_code,
    payload.analysis_system_label,
    payload.analysis_system_reason,
    payload.analysis_system_confidence,

    payload.payment_target_label,
    payload.payable_target_label,
    payload.expense_target_label,
    payload.tax_public_label,
    payload.public_utility_label,
    payload.contract_insurance_lease_label,

    payload.ai_confidence,
    payload.ai_confidence_label,
    payload.ai_reason,
    payload.review_reason,
    payload.needs_review,

    JSON.stringify(payload.ai_summary_json || {}),
    JSON.stringify(payload.sort_result_json || {}),
    JSON.stringify(payload.visible_fields_json || {}),
    JSON.stringify(payload.human_corrections_json || {}),
    JSON.stringify(payload.warnings_json || []),

    payload.original_file_name,
    payload.saved_file_name,
    payload.saved_relative_path,
    payload.sha256,
    payload.ocr_text_length,

    payload.display_rotation,
    payload.memo,
    payload.created_by_page,
    payload.created_by,
    payload.updated_by,
    payload.issue_date
  ]);

    await client.query("COMMIT");

    return {
      saved: result.rows[0] || null,
      payload
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ROLLBACK失敗より元のエラーを優先
    }

    throw err;
  } finally {
    client.release();
  }
}
/* HD_ORIGIN_PAYMENT_DOCUMENT_SORTING_DRAFT_SAVE_API_20260707_END */

/* HD_ORIGIN_PAYMENT_DOCUMENT_SORTING_DRAFT_READ_API_20260707_START */
async function hdOriginGetPaymentDocumentSortingDraftByOcrImportId(id) {
  const ocrImportId = Number(id);

  if (!Number.isInteger(ocrImportId) || ocrImportId <= 0) {
    const err = new Error("OCR取込IDが不正です。");
    err.statusCode = 400;
    throw err;
  }

  const result = await db.query(`
    SELECT
      d.payment_document_sorting_draft_id,
      d.payment_document_ocr_import_id,
      d.draft_no,
      d.draft_version,
      d.is_current,
      d.draft_status,
      d.human_check_status,

      d.document_type_id,
      d.document_type_code,
      d.document_type_label,

      d.payment_destination_id,
      d.payment_destination_code,
      d.payment_destination_label,

      d.accounting_category_id,
      d.accounting_category_code,
      d.accounting_category_label,

      d.payable_kind_id,
      d.payable_kind_code,
      d.payable_kind_label,

      d.specialist_route_code,
      d.specialist_route_label,
      d.analysis_system_code,
      d.analysis_system_label,
      d.analysis_system_reason,
      d.analysis_system_confidence,

      d.payment_target_label,
      d.payable_target_label,
      d.expense_target_label,
      d.tax_public_label,
      d.public_utility_label,
      d.contract_insurance_lease_label,

      d.ai_confidence,
      d.ai_confidence_label,
      d.ai_reason,
      d.review_reason,
      d.needs_review,

      d.ai_summary_json,
      d.sort_result_json,
      d.visible_fields_json,
      d.human_corrections_json,
      d.warnings_json,

      d.original_file_name,
      d.saved_file_name,
      d.saved_relative_path,
      d.sha256,
      d.ocr_text_length,

      d.display_rotation,
      d.memo,
      d.created_by_page,
      d.created_at,
      d.updated_at,

      o.latest_sorting_draft_id,
      o.draft_status AS ocr_draft_status,
      o.sorted_at
    FROM accounting.payment_document_sorting_drafts d
    JOIN accounting.payment_document_ocr_imports o
      ON o.payment_document_ocr_import_id = d.payment_document_ocr_import_id
    WHERE d.payment_document_ocr_import_id = $1
      AND d.is_current = TRUE
      AND d.deleted_at IS NULL
    ORDER BY d.payment_document_sorting_draft_id DESC
    LIMIT 1
  `, [ocrImportId]);

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    paymentDocumentSortingDraftId: row.payment_document_sorting_draft_id,
    paymentDocumentOcrImportId: row.payment_document_ocr_import_id,
    draftNo: row.draft_no,
    draftVersion: row.draft_version,
    isCurrent: row.is_current,
    draftStatus: row.draft_status,
    humanCheckStatus: row.human_check_status,

    documentTypeId: row.document_type_id,
    documentTypeCode: row.document_type_code,
    documentTypeLabel: row.document_type_label,

    paymentDestinationId: row.payment_destination_id,
    paymentDestinationCode: row.payment_destination_code,
    paymentDestinationLabel: row.payment_destination_label,

    accountingCategoryId: row.accounting_category_id,
    accountingCategoryCode: row.accounting_category_code,
    accountingCategoryLabel: row.accounting_category_label,

    payableKindId: row.payable_kind_id,
    payableKindCode: row.payable_kind_code,
    payableKindLabel: row.payable_kind_label,

    specialistRouteCode: row.specialist_route_code,
    specialistRouteLabel: row.specialist_route_label,
    analysisSystemCode: row.analysis_system_code,
    analysisSystemLabel: row.analysis_system_label,
    analysisSystemReason: row.analysis_system_reason,
    analysisSystemConfidence: row.analysis_system_confidence,

    paymentTargetLabel: row.payment_target_label,
    payableTargetLabel: row.payable_target_label,
    expenseTargetLabel: row.expense_target_label,
    taxPublicLabel: row.tax_public_label,
    publicUtilityLabel: row.public_utility_label,
    contractInsuranceLeaseLabel: row.contract_insurance_lease_label,

    aiConfidence: row.ai_confidence,
    aiConfidenceLabel: row.ai_confidence_label,
    aiReason: row.ai_reason,
    reviewReason: row.review_reason,
    needsReview: row.needs_review,

    aiSummary: row.ai_summary_json || {},
    sortResult: row.sort_result_json || {},
    visibleFields: row.visible_fields_json || {},
    humanCorrections: row.human_corrections_json || {},
    warnings: row.warnings_json || [],

    originalFileName: row.original_file_name,
    savedFileName: row.saved_file_name,
    savedRelativePath: row.saved_relative_path,
    sha256: row.sha256,
    ocrTextLength: row.ocr_text_length,

    displayRotation: row.display_rotation,
    memo: row.memo,
    createdByPage: row.created_by_page,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    latestSortingDraftId: row.latest_sorting_draft_id,
    ocrDraftStatus: row.ocr_draft_status,
    sortedAt: row.sorted_at
  };
}
/* HD_ORIGIN_PAYMENT_DOCUMENT_SORTING_DRAFT_READ_API_20260707_END */
/* HD_ORIGIN_CONTRACT_INSURANCE_LEASE_DRAFT_SAVE_API_20260708_START */
function hdOriginCilText(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value).trim();
}

function hdOriginCilFirstObject(...items) {
  for (const item of items) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return item;
    }
  }

  return {};
}

function hdOriginCilJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  return value;
}

function hdOriginCilNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  const text = String(value).replace(/[,￥円\s]/g, "");
  const n = Number(text);

  return Number.isFinite(n) ? n : null;
}

function hdOriginCilDateOrNull(value) {
  const text = hdOriginCilText(value);

  if (!text) return null;

  const normalized = text
    .replace(/[年月]/g, "-")
    .replace(/[日]/g, "")
    .replace(/[./]/g, "-")
    .trim();

  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (!match) return null;

  const y = match[1];
  const m = String(match[2]).padStart(2, "0");
  const d = String(match[3]).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function hdOriginCilField(fields, ...names) {
  for (const name of names) {
    const value = fields ? fields[name] : "";

    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function hdOriginCilCodeLabel(value, fallbackLabel) {
  const text = hdOriginCilText(value);
  const norm = text.replace(/\s+/g, "").toLowerCase();

  if (!norm) {
    return { code: "", label: hdOriginCilText(fallbackLabel) };
  }

  const known = {
    contract: "契約",
    insurance: "保険",
    lease: "リース",
    mixed: "混在",
    other: "その他",
    needs_review: "要確認",
    fire: "火災保険",
    vehicle: "車両",
    liability: "賠償責任保険",
    product_liability: "PL保険",
    workers_accident_extra: "労災上乗せ保険",
    life: "生命保険",
    medical: "医療保険",
    cyber: "サイバー保険",
    property: "財産保険",
    machine: "機械設備",
    it_device: "IT機器",
    office_equipment: "事務機器",
    fixture: "什器備品",
    store_equipment: "店舗設備",
    maintenance: "保守契約",
    rent: "賃貸借契約",
    service: "サービス契約",
    subscription: "サブスク契約",
    outsourcing: "業務委託契約",
    license: "ライセンス契約",
    insurance_contract: "保険契約",
    lease_contract: "リース契約",
    active: "有効",
    pending: "確認中",
    renewal_pending: "更新確認中",
    ended: "終了",
    cancelled: "解約済み",
    unpaid: "未払",
    scheduled: "支払予定",
    paid: "支払済み",
    partially_paid: "一部支払済み",
    not_applicable: "対象外",
    once: "一回",
    monthly: "毎月",
    every_two_months: "2か月ごと",
    quarterly: "四半期",
    half_year: "半年",
    yearly: "年1回",
    company: "会社負担",
    personal: "個人負担",
    none: "なし",
    exists: "あり",
    unknown: "不明",
    register: "登録する",
    not_register: "登録しない",
    yes: "あり",
    no: "なし",
    transfer: "所有権移転",
    non_transfer: "所有権移転外",
    allowed: "可能",
    not_allowed: "不可"
  };

  if (known[text]) {
    return { code: text, label: known[text] };
  }

  if (norm.includes("保険")) return { code: "insurance", label: "保険" };
  if (norm.includes("リース")) return { code: "lease", label: "リース" };
  if (norm.includes("契約")) return { code: "contract", label: "契約" };
  if (norm.includes("確認")) return { code: "needs_review", label: "要確認" };
  if (norm.includes("対象外")) return { code: "not_applicable", label: "対象外" };

  return { code: "", label: text };
}

function hdOriginCilBuildRecord(body, ocrRow, latestSortingDraftId) {
  const root = hdOriginCilFirstObject(
    body.sortResult,
    body.sort_result,
    body.sorting,
    body.classification,
    body.draft,
    body.aiDraft,
    body
  );

  const draft = hdOriginCilFirstObject(
    body.draft,
    body.aiDraft,
    body.sorting,
    body.classification,
    root.draft,
    root.sorting,
    root.classification,
    root
  );

  const aiSummary = hdOriginCilFirstObject(
    body.ai_summary,
    body.aiSummary,
    draft.ai_summary,
    draft.aiSummary,
    root.ai_summary,
    root.aiSummary
  );

  const fields = hdOriginCilFirstObject(
    body.specialistFields,
    body.specialist_fields,
    body.fields,
    body.visibleFields,
    body.visible_fields,
    draft.fields,
    root.fields
  );

  const warnings = Array.isArray(body.warnings)
    ? body.warnings
    : Array.isArray(draft.warnings)
      ? draft.warnings
      : Array.isArray(root.warnings)
        ? root.warnings
        : [];

  const now = new Date();
  const z = n => String(n).padStart(2, "0");
  const draftNo =
    "CILD-" +
    String(ocrRow.payment_document_ocr_import_id) +
    "-" +
    String(now.getFullYear()) +
    z(now.getMonth() + 1) +
    z(now.getDate()) +
    z(now.getHours()) +
    z(now.getMinutes()) +
    z(now.getSeconds());

  const cilKind = hdOriginCilCodeLabel(
    body.contractInsuranceLeaseKindCode ||
      body.contract_insurance_lease_kind_code ||
      hdOriginCilField(fields, "契約・保険・リース") ||
      aiSummary.contract_insurance_lease ||
      draft.contract_insurance_lease_label ||
      draft.contract_insurance_lease_code,
    ""
  );

  const insuranceType = hdOriginCilCodeLabel(hdOriginCilField(fields, "保険種類") || body.insurance_type_code, "");
  const leaseItemCategory = hdOriginCilCodeLabel(hdOriginCilField(fields, "リース物件区分") || body.lease_item_category_code, "");
  const contractType = hdOriginCilCodeLabel(hdOriginCilField(fields, "契約種別") || body.contract_type_code, "");
  const contractStatus = hdOriginCilCodeLabel(hdOriginCilField(fields, "契約ステータス") || body.contract_status_code, "");
  const paymentStatus = hdOriginCilCodeLabel(hdOriginCilField(fields, "支払状態") || body.payment_status_code, "");
  const paymentCycle = hdOriginCilCodeLabel(hdOriginCilField(fields, "支払周期") || body.payment_cycle_code, "");
  const companyBurden = hdOriginCilCodeLabel(hdOriginCilField(fields, "会社負担可否") || body.company_burden_code, "");
  const personalMix = hdOriginCilCodeLabel(hdOriginCilField(fields, "個人負担混在") || body.mixed_personal_flag_code, "");
  const payableRegistration = hdOriginCilCodeLabel(hdOriginCilField(fields, "未払登録") || body.payable_registration_code, "");
  const accountsPayableRegistration = hdOriginCilCodeLabel(hdOriginCilField(fields, "買掛登録") || body.accounts_payable_registration_code, "");
  const autoRenewal = hdOriginCilCodeLabel(hdOriginCilField(fields, "自動更新有無") || body.auto_renewal_code, "");
  const ownershipTransfer = hdOriginCilCodeLabel(hdOriginCilField(fields, "所有権移転区分") || body.ownership_transfer_code, "");
  const earlyCancellation = hdOriginCilCodeLabel(hdOriginCilField(fields, "中途解約可否") || body.early_cancellation_code, "");

  return {
    payment_document_ocr_import_id: Number(ocrRow.payment_document_ocr_import_id),
    payment_document_sorting_draft_id: hdOriginCilNumberOrNull(
      body.paymentDocumentSortingDraftId ||
        body.payment_document_sorting_draft_id ||
        latestSortingDraftId
    ),

    draft_no: hdOriginCilText(body.draftNo || body.draft_no || draftNo),
    draft_status: hdOriginCilText(body.draftStatus || body.draft_status || "specialist_draft_saved"),
    human_check_status: hdOriginCilText(body.humanCheckStatus || body.human_check_status || "unchecked"),
    is_current: true,

    original_file_name: hdOriginCilText(ocrRow.original_file_name || ocrRow.saved_file_name),
    saved_file_name: hdOriginCilText(ocrRow.saved_file_name),
    saved_relative_path: hdOriginCilText(ocrRow.saved_relative_path),
    sha256: hdOriginCilText(ocrRow.sha256),
    ocr_text_length: hdOriginCilNumberOrNull(ocrRow.ocr_text_length),

    document_type_code: hdOriginCilText(body.document_type_code || draft.document_type_code || aiSummary.document_kind),
    document_type_label: hdOriginCilText(body.document_type_label || draft.document_type_label || aiSummary.document_kind_label || aiSummary.document_kind),
    evidence_type_code: hdOriginCilText(hdOriginCilField(fields, "証憑区分")),
    evidence_type_label: hdOriginCilText(hdOriginCilField(fields, "証憑区分")),

    payment_destination_code: hdOriginCilText(body.payment_destination_code || draft.payment_destination_code || "contract_insurance_lease"),
    payment_destination_label: hdOriginCilText(body.payment_destination_label || draft.payment_destination_label || "契約・保険・リース"),

    contract_insurance_lease_kind_code: cilKind.code,
    contract_insurance_lease_kind_label: cilKind.label,

    analysis_system_code: hdOriginCilText(body.analysis_system_code || draft.analysis_system_code || "contract_insurance_lease_analysis"),
    analysis_system_label: hdOriginCilText(body.analysis_system_label || draft.analysis_system_label || "契約・保険・リース解析システム"),
    analysis_system_reason: hdOriginCilText(body.analysis_system_reason || draft.analysis_system_reason || aiSummary.reason),
    analysis_system_confidence: hdOriginCilText(body.analysis_system_confidence || draft.analysis_system_confidence || draft.ai_confidence || aiSummary.confidence_label),

    ai_confidence: hdOriginCilText(body.ai_confidence || draft.ai_confidence || draft.confidence || aiSummary.confidence_label),
    ai_confidence_label: hdOriginCilText(body.ai_confidence_label || draft.ai_confidence_label || draft.confidence_label || aiSummary.confidence_label),
    ai_reason: hdOriginCilText(body.ai_reason || draft.ai_reason || draft.reason || aiSummary.reason),
    review_reason: hdOriginCilText(body.review_reason || draft.review_reason || aiSummary.reason),
    needs_review: !!(body.needs_review || draft.needs_review),

    issuer_name: hdOriginCilText(hdOriginCilField(fields, "発行元")),
    vendor_name: hdOriginCilText(hdOriginCilField(fields, "支払先") || draft.vendor_name),
    insurance_company_name: hdOriginCilText(hdOriginCilField(fields, "保険会社") || hdOriginCilField(fields, "発行元")),
    lease_company_name: hdOriginCilText(hdOriginCilField(fields, "リース会社") || hdOriginCilField(fields, "発行元")),
    contract_partner_name: hdOriginCilText(hdOriginCilField(fields, "契約相手先") || hdOriginCilField(fields, "支払先")),
    recipient_name: hdOriginCilText(hdOriginCilField(fields, "宛名")),
    contractor_name: hdOriginCilText(hdOriginCilField(fields, "契約者")),
    insured_name: hdOriginCilText(hdOriginCilField(fields, "被保険者")),
    company_name: hdOriginCilText(hdOriginCilField(fields, "会社名")),
    person_name: hdOriginCilText(hdOriginCilField(fields, "個人名")),
    address: hdOriginCilText(hdOriginCilField(fields, "住所")),
    phone: hdOriginCilText(hdOriginCilField(fields, "電話番号")),
    email: hdOriginCilText(hdOriginCilField(fields, "メール")),

    contract_no: hdOriginCilText(hdOriginCilField(fields, "契約番号")),
    insurance_policy_no: hdOriginCilText(hdOriginCilField(fields, "証券番号", "保険証券番号")),
    notice_no: hdOriginCilText(hdOriginCilField(fields, "通知書番号")),
    management_no: hdOriginCilText(hdOriginCilField(fields, "管理番号")),
    customer_no: hdOriginCilText(hdOriginCilField(fields, "お客様番号")),
    member_no: hdOriginCilText(hdOriginCilField(fields, "会員番号")),
    registration_no: hdOriginCilText(hdOriginCilField(fields, "登録番号")),
    corporate_no: hdOriginCilText(hdOriginCilField(fields, "法人番号")),

    document_date: hdOriginCilDateOrNull(hdOriginCilField(fields, "書類日付")),
    issue_date: hdOriginCilDateOrNull(hdOriginCilField(fields, "発行日", "通知日")),
    due_date: hdOriginCilDateOrNull(hdOriginCilField(fields, "支払期限・納期限", "支払期限", "納期限")),
    payment_plan_date: hdOriginCilDateOrNull(hdOriginCilField(fields, "支払予定日", "支払日")),
    withdrawal_date: hdOriginCilDateOrNull(hdOriginCilField(fields, "引落日")),
    contract_start_date: hdOriginCilDateOrNull(hdOriginCilField(fields, "契約開始日")),
    contract_end_date: hdOriginCilDateOrNull(hdOriginCilField(fields, "契約終了日")),
    service_period_start: hdOriginCilDateOrNull(hdOriginCilField(fields, "対象開始日", "保険期間開始日")),
    service_period_end: hdOriginCilDateOrNull(hdOriginCilField(fields, "対象終了日", "保険期間終了日")),
    renewal_date: hdOriginCilDateOrNull(hdOriginCilField(fields, "更新日")),
    cancellation_notice_date: hdOriginCilDateOrNull(hdOriginCilField(fields, "解約通知期限")),
    cancellation_date: hdOriginCilDateOrNull(hdOriginCilField(fields, "解約日")),

    payment_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "請求・支払金額", "支払金額", "保険料")),
    monthly_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "月額金額", "月額リース料", "月額契約料")),
    annual_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "年額金額", "年額契約料")),
    total_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "合計金額", "リース総額")),
    amount_ex_tax: hdOriginCilNumberOrNull(hdOriginCilField(fields, "税抜金額")),
    tax_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "消費税額")),
    amount_in_tax: hdOriginCilNumberOrNull(hdOriginCilField(fields, "税込金額")),
    non_tax_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "非課税・不課税金額")),
    fee_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "手数料")),
    late_fee_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "延滞金")),
    discount_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "割引・値引")),

    payment_method_code: hdOriginCilText(hdOriginCilField(fields, "支払方法", "支払方法マスタ")),
    payment_method_label: hdOriginCilText(hdOriginCilField(fields, "支払方法", "支払方法マスタ")),
    payment_status_code: paymentStatus.code,
    payment_status_label: paymentStatus.label,
    payment_cycle_code: paymentCycle.code,
    payment_cycle_label: paymentCycle.label,
    payment_count: hdOriginCilNumberOrNull(hdOriginCilField(fields, "支払回数")),

    transfer_bank_name: hdOriginCilText(hdOriginCilField(fields, "振込先銀行")),
    debit_bank_name: hdOriginCilText(hdOriginCilField(fields, "引落銀行")),
    bank_account_no: hdOriginCilText(hdOriginCilField(fields, "口座番号")),
    bank_account_name: hdOriginCilText(hdOriginCilField(fields, "口座名義")),

    accounting_category_code: hdOriginCilText(body.accounting_category_code || draft.accounting_category_code || hdOriginCilField(fields, "会計区分")),
    accounting_category_label: hdOriginCilText(body.accounting_category_label || draft.accounting_category_label || hdOriginCilField(fields, "会計区分")),
    payable_kind_code: hdOriginCilText(body.payable_kind_code || draft.payable_kind_code || hdOriginCilField(fields, "未払種別")),
    payable_kind_label: hdOriginCilText(body.payable_kind_label || draft.payable_kind_label || hdOriginCilField(fields, "未払種別")),
    account_title_code: hdOriginCilText(hdOriginCilField(fields, "勘定科目")),
    account_title_label: hdOriginCilText(hdOriginCilField(fields, "勘定科目")),
    tax_category_code: hdOriginCilText(hdOriginCilField(fields, "税区分")),
    tax_category_label: hdOriginCilText(hdOriginCilField(fields, "税区分")),
    invoice_type_code: hdOriginCilText(hdOriginCilField(fields, "インボイス区分")),
    invoice_type_label: hdOriginCilText(hdOriginCilField(fields, "インボイス区分")),

    target_person_label: hdOriginCilText(hdOriginCilField(fields, "対象者")),
    purpose_label: hdOriginCilText(hdOriginCilField(fields, "目的")),
    project_label: hdOriginCilText(hdOriginCilField(fields, "案件")),
    department_label: hdOriginCilText(hdOriginCilField(fields, "部門")),

    payable_registration_code: payableRegistration.code,
    payable_registration_label: payableRegistration.label,
    accounts_payable_registration_code: accountsPayableRegistration.code,
    accounts_payable_registration_label: accountsPayableRegistration.label,
    company_burden_code: companyBurden.code,
    company_burden_label: companyBurden.label,
    mixed_personal_flag_code: personalMix.code,
    mixed_personal_flag_label: personalMix.label,

    summary: hdOriginCilText(hdOriginCilField(fields, "摘要") || draft.summary),
    memo: hdOriginCilText(body.memo || draft.memo || "契約・保険・リース専門画面から保存"),
    internal_memo: hdOriginCilText(body.internal_memo || ""),
    review_memo: hdOriginCilText(hdOriginCilField(fields, "要確認メモ")),

    insurance_type_code: insuranceType.code,
    insurance_type_label: insuranceType.label,
    insurance_target: hdOriginCilText(hdOriginCilField(fields, "保険対象")),
    insurance_period_start: hdOriginCilDateOrNull(hdOriginCilField(fields, "保険期間開始日", "対象開始日")),
    insurance_period_end: hdOriginCilDateOrNull(hdOriginCilField(fields, "保険期間終了日", "対象終了日")),
    insurance_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "保険料")),

    lease_item_name: hdOriginCilText(hdOriginCilField(fields, "リース物件")),
    lease_item_category_code: leaseItemCategory.code,
    lease_item_category_label: leaseItemCategory.label,
    monthly_lease_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "月額リース料", "月額金額")),
    lease_total_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "リース総額", "合計金額")),
    ownership_transfer_code: ownershipTransfer.code,
    ownership_transfer_label: ownershipTransfer.label,
    early_cancellation_code: earlyCancellation.code,
    early_cancellation_label: earlyCancellation.label,
    residual_value_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "残価")),

    contract_type_code: contractType.code,
    contract_type_label: contractType.label,
    contract_name: hdOriginCilText(hdOriginCilField(fields, "契約名", "書類名")),
    auto_renewal_code: autoRenewal.code,
    auto_renewal_label: autoRenewal.label,
    contract_status_code: contractStatus.code,
    contract_status_label: contractStatus.label,
    monthly_contract_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "月額契約料", "月額金額")),
    annual_contract_amount: hdOriginCilNumberOrNull(hdOriginCilField(fields, "年額契約料", "年額金額")),

    specialist_fields_json: fields,
    ai_summary_json: aiSummary,
    ai_raw_json: root,
    visible_fields_json: hdOriginCilJson(body.visibleFields || body.visible_fields || fields, {}),
    human_corrections_json: hdOriginCilJson(body.humanCorrections || body.human_corrections || {}, {}),
    warnings_json: warnings,

    created_by_page: "payment-document-specialist-contract-insurance-lease.html",
    created_by: "system",
    updated_by: "system"
  };
}

async function hdOriginSaveContractInsuranceLeaseDraft(body) {
  const ocrImportId = Number(
    body.paymentDocumentOcrImportId ||
      body.payment_document_ocr_import_id ||
      body.ocrImportId ||
      body.id
  );

  if (!Number.isInteger(ocrImportId) || ocrImportId < 1) {
    const err = new Error("不正なOCR取込IDです。");
    err.statusCode = 400;
    throw err;
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const ocrResult = await client.query(`
      SELECT
        payment_document_ocr_import_id,
        original_file_name,
        saved_file_name,
        saved_relative_path,
        sha256,
        ocr_text_length,
        latest_sorting_draft_id
      FROM accounting.payment_document_ocr_imports
      WHERE payment_document_ocr_import_id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `, [ocrImportId]);

    if (!ocrResult.rows.length) {
      const err = new Error("OCR取込データが見つかりません。");
      err.statusCode = 404;
      throw err;
    }

    const ocrRow = ocrResult.rows[0];

    const latestSortingDraftId =
      hdOriginCilNumberOrNull(body.paymentDocumentSortingDraftId || body.payment_document_sorting_draft_id) ||
      hdOriginCilNumberOrNull(ocrRow.latest_sorting_draft_id);

    const record = hdOriginCilBuildRecord(body, ocrRow, latestSortingDraftId);

    /*
      共通専門解析結果と契約専門下書きを結ぶ。
      DB列が存在する場合だけ、既存の動的INSERT処理で保存される。
    */
    record.specialist_analysis_id =
      hdOriginCilNumberOrNull(
        body.specialistAnalysisId ||
        body.specialist_analysis_id ||
        body.latestSpecialistAnalysisId
      );

    await client.query(`
      UPDATE accounting.payment_document_contract_insurance_lease_drafts
      SET
        is_current = FALSE,
        updated_at = now()
      WHERE payment_document_ocr_import_id = $1
        AND is_current = TRUE
        AND deleted_at IS NULL
    `, [ocrImportId]);

    const colResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'accounting'
        AND table_name = 'payment_document_contract_insurance_lease_drafts'
    `);

    const existingCols = new Set(colResult.rows.map(row => row.column_name));

    const columns = Object.keys(record)
      .filter(key => existingCols.has(key))
      .filter(key => record[key] !== undefined);

    /* HD_ORIGIN_CIL_JSONB_STRINGIFY_FIX_20260708_START */
    const jsonbColumns = new Set([
      "specialist_fields_json",
      "ai_summary_json",
      "ai_raw_json",
      "visible_fields_json",
      "human_corrections_json",
      "warnings_json"
    ]);

    const values = columns.map(key => {
      const value = record[key];

      if (!jsonbColumns.has(key)) {
        return value;
      }

      if (value === null || value === undefined || value === "") {
        return JSON.stringify(key === "warnings_json" ? [] : {});
      }

      if (typeof value === "string") {
        try {
          JSON.parse(value);
          return value;
        } catch {
          return JSON.stringify(value);
        }
      }

      return JSON.stringify(value);
    });
    /* HD_ORIGIN_CIL_JSONB_STRINGIFY_FIX_20260708_END */

    const placeholders = columns.map((_, index) => "$" + (index + 1));

    const insertResult = await client.query(`
      INSERT INTO accounting.payment_document_contract_insurance_lease_drafts (
        ${columns.map(col => '"' + col.replace(/"/g, '""') + '"').join(", ")}
      )
      VALUES (${placeholders.join(", ")})
      RETURNING
        contract_insurance_lease_draft_id,
        payment_document_ocr_import_id,
        payment_document_sorting_draft_id,
        draft_no,
        is_current,
        draft_status,
        created_at
    `, values);

    await client.query("COMMIT");

    const row = insertResult.rows[0];

    return {
      ok: true,
      contractInsuranceLeaseDraftId: row.contract_insurance_lease_draft_id,
      paymentDocumentOcrImportId: row.payment_document_ocr_import_id,
      paymentDocumentSortingDraftId: row.payment_document_sorting_draft_id,
      draftNo: row.draft_no,
      isCurrent: row.is_current,
      draftStatus: row.draft_status,
      createdAt: row.created_at
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // 元エラーを優先
    }

    throw err;
  } finally {
    client.release();
  }
}
/* HD_ORIGIN_CONTRACT_INSURANCE_LEASE_DRAFT_SAVE_API_20260708_END */
/* HD_ORIGIN_BUSINESS_FLOW_AI_ROUTE_20260709_START */
function hdOriginBusinessFlowPromptCommonDir() {
  return path.join(__dirname, "prompts", "common");
}

function hdOriginBusinessFlowRulesFilePath() {
  return path.join(hdOriginBusinessFlowPromptCommonDir(), "company-business-flow-rules.txt");
}

function hdOriginBusinessFlowNotesFilePath() {
  return path.join(hdOriginBusinessFlowPromptCommonDir(), "general-affairs-ai-notes.md");
}

function hdOriginBusinessFlowChangelogFilePath() {
  return path.join(hdOriginBusinessFlowPromptCommonDir(), "general-affairs-ai-changelog.md");
}

function hdOriginBusinessFlowCleanText(value, maxLength) {
  return String(value || "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, maxLength || 20000);
}

function hdOriginBusinessFlowArray(value) {
  return Array.isArray(value) ? value : [];
}

function hdOriginNormalizeBusinessFlowAnalysis(parsed, sourceText) {
  const raw = parsed && typeof parsed === "object" ? parsed : {};
  const analysis = {
    summary: hdOriginBusinessFlowCleanText(raw.summary || raw.ai_summary || raw.overview || "", 3000),
    rules: Array.isArray(raw.rules) ? raw.rules : [],
    routing: raw.routing && typeof raw.routing === "object" ? raw.routing : {},
    prompt_text: hdOriginBusinessFlowCleanText(raw.prompt_text || raw.promptText || raw.rule_prompt || "", 8000),
    human_check_points: hdOriginBusinessFlowArray(raw.human_check_points || raw.humanCheckPoints),
    warnings: hdOriginBusinessFlowArray(raw.warnings)
  };

  if (!analysis.summary) {
    analysis.summary = "入力された業務メモを、会社業務ルール候補として整理しました。";
  }

  if (!analysis.prompt_text) {
    analysis.prompt_text = analysis.summary;
  }

  analysis.rules = analysis.rules.map(rule => {
    const r = rule && typeof rule === "object" ? rule : { rule_text: String(rule || "") };
    return {
      rule_type: hdOriginBusinessFlowCleanText(r.rule_type || r.ruleType || "", 100),
      category: hdOriginBusinessFlowCleanText(r.category || "", 200),
      payment_timing: hdOriginBusinessFlowCleanText(r.payment_timing || r.paymentTiming || "", 200),
      document_status: hdOriginBusinessFlowCleanText(r.document_status || r.documentStatus || "", 200),
      evidence_policy: hdOriginBusinessFlowCleanText(r.evidence_policy || r.evidencePolicy || "", 300),
      bank_or_payment_method: hdOriginBusinessFlowCleanText(r.bank_or_payment_method || r.bankOrPaymentMethod || r.payment_method || "", 200),
      human_check_required: r.human_check_required !== false,
      rule_text: hdOriginBusinessFlowCleanText(r.rule_text || r.ruleText || r.summary || "", 1000),
      warnings: hdOriginBusinessFlowArray(r.warnings).map(x => hdOriginBusinessFlowCleanText(x, 300)).filter(Boolean)
    };
  }).filter(rule => rule.rule_text || rule.category);

  if (analysis.rules.length < 1) {
    analysis.rules.push({
      rule_type: "free_text_business_rule",
      category: "要確認",
      payment_timing: "",
      document_status: "",
      evidence_policy: "証憑・銀行明細・支払先・金額を既存DB・会社マスタ・過去処理・原本画像から自動照合し、矛盾が解消できない場合だけ例外として停止する。",
      bank_or_payment_method: "",
      human_check_required: true,
      rule_text: analysis.prompt_text || hdOriginBusinessFlowCleanText(sourceText, 1000),
      warnings: ["自動処理に必要な情報を既存DB・会社マスタ・過去処理・原本画像から補完できませんでした。処理を例外停止し、不足項目だけを提示します。"]
    });
  }

  return analysis;
}

async function hdOriginAnalyzeBusinessFlowWithOpenAi(sourceText) {
  const cleanText = hdOriginBusinessFlowCleanText(sourceText, 20000);

  const systemMessage = [
    "あなたはHD Origin Projectの総務AI設定補助です。",
    "ユーザーが自由に書いた業務メモを、会社の業務フロー・支払ルール・証憑確認ルールとして精査してください。",
    "会計仕訳や支払承認を最終確定してはいけません。",
    "書類なし支払、定期支払、銀行引落、証憑後追い、公共料金、家賃、税金、公的支払、請求未払、レシート、カード明細などに振り分けてください。",
    "必ずJSONのみを返してください。"
  ].join("\n");

  const prompt = [
    "以下の自由入力メモを解析し、JSONで返してください。",
    "",
    "【返却JSON形式】",
    "{",
    "  \"summary\": \"短い整理文\",",
    "  \"routing\": {",
    "    \"業務区分\": [\"公共料金\", \"定期支払\"],",
    "    \"支払区分\": [\"銀行引落\"],",
    "    \"証憑状態\": [\"証憑後追い確認\"]",
    "  },",
    "  \"rules\": [",
    "    {",
    "      \"rule_type\": \"recurring_payment / no_document_payment / bank_withdrawal / tax_public / payable / receipt_evidence / other\",",
    "      \"category\": \"公共料金・家賃・税金など\",",
    "      \"payment_timing\": \"毎月25日など。なければ空欄\",",
    "      \"document_status\": \"書類あり・書類なし・後日回収など\",",
    "      \"evidence_policy\": \"証憑確認方針\",",
    "      \"bank_or_payment_method\": \"銀行引落・BIZ・現金・不明など\",",
    "      \"human_check_required\": true,",
    "      \"rule_text\": \"総務AIが今後読むための自然文ルール\",",
    "      \"warnings\": [\"注意点\"]",
    "    }",
    "  ],",
    "  \"prompt_text\": \"総務AIプロンプトへ追加する短い会社ルール文\",",
    "  \"human_check_points\": [\"人間が確認すべき点\"],",
    "  \"warnings\": [\"AIが勝手に確定してはいけない注意\"]",
    "}",
    "",
    "【絶対ルール】",
    "- AI判断だけで支払済み・会計仕訳・承認済みにしない。",
    "- 書類がないものは、証憑未回収または要確認を残す。",
    "- 金額、支払先、日付、銀行明細が一致しない場合は要確認にする。",
    "- ユーザーの曖昧な表現は、業務ルール候補として整理し、断定しすぎない。",
    "",
    "【自由入力メモ】",
    cleanText
  ].join("\n");

  const response = await callPaymentDocumentOpenAiJson(prompt, systemMessage);
  return hdOriginNormalizeBusinessFlowAnalysis(response.parsed, cleanText);
}

function hdOriginBuildBusinessFlowPromptText(sourceText, analysis) {
  const now = new Date().toISOString();
  const lines = [];

  lines.push("【HD Origin Project 会社業務フロー追加ルール】");
  lines.push("");
  lines.push("このファイルは、業務フロー設定画面の自由入力をAIが整理した会社独自ルールです。");
  lines.push("支払書類AI・総務AIは、OCR本文だけでなく、この会社ルールも参考にしてください。");
  lines.push("ただし、このルールだけで支払承認・会計仕訳・台帳確定をしてはいけません。");
  lines.push("証憑不足、金額不一致、支払先不一致、日付不一致は必ず要確認にしてください。");
  lines.push("");
  lines.push("更新日時: " + now);
  lines.push("");
  lines.push("【AI整理】");
  lines.push(analysis.summary || "");
  lines.push("");
  lines.push("【総務AIに追加する短縮ルール】");
  lines.push(analysis.prompt_text || "");
  lines.push("");
  lines.push("【業務ルール候補】");

  for (const rule of analysis.rules || []) {
    lines.push("");
    lines.push("- 区分: " + (rule.category || "未分類"));
    if (rule.rule_type) lines.push("  種別: " + rule.rule_type);
    if (rule.payment_timing) lines.push("  支払タイミング: " + rule.payment_timing);
    if (rule.document_status) lines.push("  書類状態: " + rule.document_status);
    if (rule.bank_or_payment_method) lines.push("  支払方法: " + rule.bank_or_payment_method);
    if (rule.evidence_policy) lines.push("  証憑確認: " + rule.evidence_policy);
    lines.push("  ルール: " + (rule.rule_text || ""));
    lines.push("  自動処理方針: 通常処理はAIとシステムで完了し、解消不能な例外だけ停止");
    for (const warning of rule.warnings || []) {
      lines.push("  注意: " + warning);
    }
  }

  lines.push("");
  lines.push("【例外停止条件】");
  for (const point of analysis.human_check_points || []) {
    lines.push("- " + point);
  }

  lines.push("");
  lines.push("【注意】");
  for (const warning of analysis.warnings || []) {
    lines.push("- " + warning);
  }

  lines.push("");
  lines.push("【元の自由入力】");
  lines.push(sourceText);

  return lines.join("\n");
}

function hdOriginAppendBusinessFlowMemoFiles(sourceText, analysis) {
  const now = new Date().toISOString();
  const notesPath = hdOriginBusinessFlowNotesFilePath();
  const changelogPath = hdOriginBusinessFlowChangelogFilePath();

  const noteText = [
    "",
    "## 業務フロー設定AI入力 " + now,
    "",
    "### 元入力",
    "",
    sourceText,
    "",
    "### AI整理",
    "",
    analysis.summary || "",
    "",
    "### 総務AI追加ルール",
    "",
    analysis.prompt_text || "",
    ""
  ].join("\n");

  const changeText = [
    "",
    "## " + now + " 業務フロー設定AI入力",
    "",
    "- 業務フロー設定画面の自由入力をAI解析",
    "- company-business-flow-rules.txt を更新",
    "- 書類なし支払・定期支払・銀行引落・証憑後追い確認ルールの追加候補を反映",
    ""
  ].join("\n");

  try {
    fs.appendFileSync(notesPath, noteText, "utf8");
  } catch {
    // メモ追記失敗はAPI全体を止めない
  }

  try {
    fs.appendFileSync(changelogPath, changeText, "utf8");
  } catch {
    // 変更履歴追記失敗はAPI全体を止めない
  }
}

function hdOriginSaveBusinessFlowRules(sourceText, analysis) {
  const commonDir = hdOriginBusinessFlowPromptCommonDir();
  fs.mkdirSync(commonDir, { recursive: true });

  const filePath = hdOriginBusinessFlowRulesFilePath();
  const text = hdOriginBuildBusinessFlowPromptText(sourceText, analysis);

  fs.writeFileSync(filePath, text, "utf8");
  hdOriginAppendBusinessFlowMemoFiles(sourceText, analysis);

  return {
    filePath,
    relativePath: path.relative(path.join(__dirname, "prompts"), filePath).replace(/\\/g, "/"),
    bytes: Buffer.byteLength(text, "utf8")
  };
}

function hdOriginBusinessFlowGetOpenAiApiKey() {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.HD_ORIGIN_OPENAI_API_KEY ||
    process.env.OPENAI_KEY ||
    ""
  );
}

function hdOriginBusinessFlowGetOpenAiModel() {
  return process.env.OPENAI_MODEL || process.env.HD_ORIGIN_OPENAI_MODEL || "gpt-4.1-mini";
}
/* HD_ORIGIN_BUSINESS_FLOW_AI_SUGGEST_20260709_START */
function hdOriginReadTextFileSafe(filePath, maxLength) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return "";
    return String(fs.readFileSync(filePath, "utf8") || "").slice(0, maxLength || 20000);
  } catch {
    return "";
  }
}

async function hdOriginSuggestBusinessFlowImprovements(payload) {
  const apiKey = hdOriginBusinessFlowGetOpenAiApiKey();

  if (!apiKey) {
    const err = new Error("OPENAI_API_KEY が未設定です。");
    err.statusCode = 500;
    throw err;
  }

  const flow = payload && payload.flow && typeof payload.flow === "object" ? payload.flow : {};
  const currentAiResult = hdOriginBusinessFlowCleanText(payload && payload.currentAiResult, 12000);

  const companyRules = hdOriginReadTextFileSafe(hdOriginBusinessFlowRulesFilePath(), 20000);
  const generalAffairs = hdOriginReadTextFileSafe(path.join(hdOriginBusinessFlowPromptCommonDir(), "general-affairs-ai.txt"), 20000);
  const notes = hdOriginReadTextFileSafe(path.join(hdOriginBusinessFlowPromptCommonDir(), "general-affairs-ai-notes.md"), 20000);
  /*
    HD_ORIGIN_HUMAN_ERROR_ELIMINATION_POLICY_20260711

    最上位目標は完全機械化による人間のミスの除去。
    機械の誤り対策として人間確認を通常工程へ戻さない。
  */
  const humanErrorEliminationPolicy = [
    "【最上位目標】",
    "HD Origin Projectは、可能な限り完全機械化し、人間が作業へ介在することで発生するミスをなくします。",
    "目的は、機械のミスを理由に人間確認を増やすことではありません。",
    "人間の転記、選択、照合、計算、分類、確認、追跡、督促、再入力をシステムから除去してください。",
    "",
    "【基本原則】",
    "- 通常案件は、最初から最後までAIとシステムだけで完了させる。",
    "- 人間の最終確認を通常処理の必須工程にしない。",
    "- 人間が確認しやすい画面ではなく、人間が確認しなくてよい自動処理を提案する。",
    "- 人間確認件数を減らすのではなく、原則ゼロへ近づける。",
    "- 情報不足を理由として、直ちに人間へ処理を返さない。",
    "",
    "【機械の誤りへの対応】",
    "- 機械の誤りは、別データとの自動照合、複数AI判定、再解析、再計算、整合性検査で検出する。",
    "- 金額は請求書、明細合計、銀行明細、支払実績を機械的に相互照合する。",
    "- 会社はcompany_id、口座会社、取引先履歴、証憑情報を機械的に照合する。",
    "- 分類結果はOCR、専門解析、過去確定処理、マスタを機械的に照合する。",
    "- 不一致時は、システムが原因候補を特定して再処理する。",
    "- 自動修正できない不一致は処理を安全停止し、勝手に確定しない。",
    "- 安全停止は、人間確認を通常業務へ戻すことを意味しない。",
    "",
    "【提案禁止】",
    "- 人間の最終確認を必須とする提案。",
    "- 人間確認を促すだけの一覧、警告、フラグ、履歴。",
    "- 承認待ち件数や確認待ち件数を増やす設計。",
    "- 人間が効率的に確認できることを、自動化として扱う提案。",
    "- 差異を発見しただけで人間へ丸投げする提案。",
    "- 担当者が追跡、督促、照合、転記する提案。",
    "",
    "【自動化する対象】",
    "- 証憑後追いは、自動追跡、自動取得、自動照合、自動督促する。",
    "- 複数会社はcompany_idで自動分離し、会社間混同をシステム的に不可能にする。",
    "- 役職と権限はDBから自動判定し、許可されない処理をシステムが拒否する。",
    "- 銀行明細と支払予定・実績は自動照合し、一致分を自動完了する。",
    "- 納品書と請求書は明細単位で自動突合し、一致分を自動完了する。",
    "- 源泉徴収は取引先属性、報酬区分、請求書表示、税務ルールから自動判定する。",
    "- 未払消込、銀行出金、源泉預り金、取消を一連の処理として自動実行する。",
    "",
    "【人間が残る場合】",
    "法令上本人の意思表示そのものが必要な行為など、機械が代行できない行為だけを残します。",
    "人間作業を残す場合は、自動化できない法的または物理的理由を具体的に示してください。",
    "単に危険、重要、情報不足という理由では人間作業を残してはいけません。",
    "",
    "【提案の必須評価】",
    "各提案について、なくなる人間作業、機械が実行する処理、使用するDB・API・AI、機械的な誤り検出方法を明示してください。",
    "人間の確認工程を追加する提案ではなく、人間がミスを起こす機会そのものを削除する提案を優先してください。"
  ].join("\n");

  const systemMessage = [
    "あなたはHD Origin Projectの業務設計アドバイザーです。",
    "役割は、会社業務を可能な限り完全機械化し、人間が作業へ介在することで発生する転記・選択・判断・確認・見落としのミスをなくすことです。",
    "通常案件をAIとシステムだけで完了させる実装案を提示してください。機械の誤りは機械的な照合・再解析・再計算・安全停止で制御し、人間確認へ戻してはいけません。",
    "会計仕訳や支払承認をAIだけで最終確定する提案は禁止です。",
    "必ずJSONのみを返してください。"
  ].join("\n");

  const prompt = [
    "以下の最上位方針は、過去メモ、旧ルール、旧確認方針より必ず優先します。",
    "",
    humanErrorEliminationPolicy,
    "",
    "以下はHD Origin Projectの現在の業務フロー設定、AI解析結果、育成済み総務AIプロンプトです。",
    "この内容を見て、今後作るべきもの・変えた方がいいもの・不足しているものを提案してください。",
    "",
    "【返却JSON形式】",
    "{",
    "  \"summary\": \"全体所見\",",
    "  \"missing_items\": [",
    "    {\"title\":\"足りないもの\", \"reason\":\"理由\", \"risk\":\"放置リスク\", \"suggestion\":\"提案\"}",
    "  ],",
    "  \"improvements\": [",
    "    {\"title\":\"改善対象\", \"current_issue\":\"現状の問題\", \"change_to\":\"変更案\", \"reason\":\"理由\"}",
    "  ],",
    "  \"new_feature_ideas\": [",
    "    {\"title\":\"作るとよい画面や機能\", \"purpose\":\"目的\", \"fields\":[\"必要項目\"], \"priority\":\"高/中/低\"}",
    "  ],",
    "  \"prompt_growth_ideas\": [",
    "    {\"title\":\"プロンプト追記候補\", \"add_rule\":\"追記案\", \"reason\":\"理由\"}",
    "  ],",
    "  \"exception_stop_conditions\": [\"機械的な再解析・再照合でも処理不能となる条件\"],",
    "  \"human_work_eliminated\": [\"今回なくなる人間作業\"],",
    "  \"machine_actions\": [\"AIとシステムが自動実行する処理\"],",
    "  \"machine_error_controls\": [\"機械同士の照合・再計算・整合性検査・安全停止方法\"],",
    "  \"remaining_human_actions\": [",
    "    {\"action\":\"残る行為\", \"legal_or_physical_reason\":\"機械化不能な法的または物理的理由\"}",
    "  ],",
    "  \"priority_order\": [\"次にやる順番\"]",
    "}",
    "",
    "【判断観点】",
    "- 書類がある業務だけでなく、書類なし支払、銀行引落、定期支払、証憑後追いを考慮する。",
    "- 原則としてAIとシステムが処理を完了する。人間が作業へ介在してミスを起こす機会そのものを削除する。",
    "- 機械の誤りは、機械同士の照合、再解析、再計算、整合性検査、安全停止で制御する。",
    "- 機械の誤り対策として、人間の最終確認を通常フローへ追加してはいけない。",
    "- 『人間が確認しやすくなる』ではなく、『人間が確認しなくてよくなる』実装を提案する。",
    "- 人間の追跡、督促、転記、照合、分類、金額確認、会社選択を残さない。",
    "- 人間作業を残す場合は、機械化できない法的または物理的理由を明示する。",
    "- 真の例外条件がない場合、人間確認・承認待ち・確認履歴を新規提案してはいけない。",
    "- DB、台帳、画面、ボタン、一覧、警告、プロンプト追記のどれが必要か考える。",
    "- 社長が雑に書いた言葉がプロンプトとして育っていく前提で、次の育成候補を提案する。",
    "",
    "【画面入力 flow】",
    JSON.stringify(flow, null, 2),
    "",
    "【現在画面に出ているAI解析結果】",
    currentAiResult,
    "",
    "【company-business-flow-rules.txt】",
    companyRules,
    "",
    "【general-affairs-ai.txt】",
    generalAffairs,
    "",
    "【general-affairs-ai-notes.md】",
    notes
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: hdOriginBusinessFlowGetOpenAiModel(),
      temperature: 0.2,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && data.error && data.error.message
        ? data.error.message
        : "OpenAI API エラー: HTTP " + response.status;
    const err = new Error(message);
    err.statusCode = response.status || 500;
    throw err;
  }

  const content =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
      ? data.choices[0].message.content
      : "";

  try {
    return JSON.parse(content);
  } catch {
    const err = new Error("AI改善提案結果をJSONとして読めませんでした。");
    err.statusCode = 500;
    throw err;
  }
}
/* HD_ORIGIN_BUSINESS_FLOW_AI_SUGGEST_20260709_END */
/* HD_ORIGIN_BUSINESS_FLOW_AI_ROUTE_20260709_END */

/* HD_ORIGIN_ACCESS_FIRST_AI_20260718_START */
function hdOriginAccessFirstAiArray(value) {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const source =
            item && typeof item === "object"
              ? item
              : {};

          return {
            code: String(source.code || "").trim(),
            label: String(source.label || source.name || "").trim()
          };
        })
        .filter((item) => item.code)
    : [];
}

function hdOriginAccessFirstAiText(value) {
  return String(
    value === null || value === undefined
      ? ""
      : value
  ).trim();
}

function hdOriginAccessFirstAiWarnings(value) {
  return Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];
}

function hdOriginAccessFirstAiConfidence(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(1, number));
}

function hdOriginAccessFirstAiFindCandidate(candidates, code) {
  const target = String(code || "").trim();

  return candidates.find(
    (item) => item.code === target
  ) || null;
}

async function callHdOriginAccessFirstAiOpenAiJson(
  userPrompt,
  systemPrompt,
  allowedCodes
) {
  const apiKey = getOpenAiApiKey();

  const companyCodes = Array.isArray(
    allowedCodes && allowedCodes.companyCodes
  )
    ? allowedCodes.companyCodes
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    : [];

  const documentTypeCodes = Array.isArray(
    allowedCodes && allowedCodes.documentTypeCodes
  )
    ? allowedCodes.documentTypeCodes
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    : [];

  const analysisSystemCodes = Array.isArray(
    allowedCodes && allowedCodes.analysisSystemCodes
  )
    ? allowedCodes.analysisSystemCodes
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    : [];

  if (
    !companyCodes.length ||
    !documentTypeCodes.length ||
    !analysisSystemCodes.length
  ) {
    const error = new Error(
      "Access一次判定AIの候補コードが不足しています。"
    );

    error.statusCode = 500;
    throw error;
  }

  if (!apiKey) {
    const error = new Error(
      "OPENAI_API_KEY が未設定です。"
    );

    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
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
            content: String(
              systemPrompt || ""
            )
          },
          {
            role: "user",
            content: String(
              userPrompt || ""
            )
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "hd_origin_access_first_decision",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                company_code: {
                  type: "string",
                  enum: companyCodes
                },
                document_type_code: {
                  type: "string",
                  enum: documentTypeCodes
                },
                analysis_system_code: {
                  type: "string",
                  enum: analysisSystemCodes
                },
                confidence: {
                  type: "number",
                  minimum: 0,
                  maximum: 1
                },
                reason: {
                  type: "string"
                },
                needs_review: {
                  type: "boolean"
                },
                warnings: {
                  type: "array",
                  items: {
                    type: "string"
                  }
                }
              },
              required: [
                "company_code",
                "document_type_code",
                "analysis_system_code",
                "confidence",
                "reason",
                "needs_review",
                "warnings"
              ]
            }
          }
        }
      })
    }
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const message =
      data &&
      data.error &&
      data.error.message
        ? data.error.message
        : "OpenAI API error: " +
          String(response.status);

    const error = new Error(message);
    error.statusCode =
      response.status || 500;

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

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    const error = new Error(
      "Access一次判定AI応答をJSONとして解析できませんでした。"
    );

    error.statusCode = 500;
    throw error;
  }

  return {
    parsed,
    usage:
      data && data.usage
        ? data.usage
        : null
  };
}
async function createHdOriginAccessFirstAiDecision(body) {
  const ocrText = hdOriginAccessFirstAiText(
    body.ocr_text ||
    body.ocrText
  );

  if (!ocrText) {
    const error = new Error("OCR本文が空です。");
    error.statusCode = 400;
    throw error;
  }

  const companies = hdOriginAccessFirstAiArray(
    body.candidate_companies ||
    body.candidateCompanies
  );

  const documentTypes = hdOriginAccessFirstAiArray(
    body.candidate_document_types ||
    body.candidateDocumentTypes
  );

  const specialists = hdOriginAccessFirstAiArray(
    body.candidate_specialists ||
    body.candidateSpecialists
  );

  if (!companies.length) {
    const error = new Error("会社候補がありません。");
    error.statusCode = 400;
    throw error;
  }

  if (!documentTypes.length) {
    const error = new Error("文書種別候補がありません。");
    error.statusCode = 400;
    throw error;
  }

  if (!specialists.length) {
    const error = new Error("専門解析候補がありません。");
    error.statusCode = 400;
    throw error;
  }

  const userPrompt = [
    "次のOCR本文を一次判定してください。",
    "",
    "candidate_companies:",
    JSON.stringify(companies, null, 2),
    "",
    "candidate_document_types:",
    JSON.stringify(documentTypes, null, 2),
    "",
    "candidate_specialists:",
    JSON.stringify(specialists, null, 2),
    "",
    "OCR本文:",
    ocrText
  ].join("\n");

  const systemPrompt =
    loadPaymentDocumentPromptText(
      "access-first-decision.system.txt",
      ""
    );

  if (!String(systemPrompt || "").trim()) {
    const error = new Error(
      "Access一次判定プロンプトを読み込めません。"
    );

    error.statusCode = 500;
    throw error;
  }

  const response =
    await callHdOriginAccessFirstAiOpenAiJson(
      userPrompt,
      systemPrompt,
      {
        companyCodes:
          companies.map((item) => item.code),
        documentTypeCodes:
          documentTypes.map((item) => item.code),
        analysisSystemCodes:
          specialists.map((item) => item.code)
      }
    );

  const parsed =
    response &&
    response.parsed &&
    typeof response.parsed === "object"
      ? response.parsed
      : {};

  const companyCode =
    hdOriginAccessFirstAiText(
      parsed.company_code ||
      parsed.companyCode
    );

  const documentTypeCode =
    hdOriginAccessFirstAiText(
      parsed.document_type_code ||
      parsed.documentTypeCode
    );

  const analysisSystemCode =
    hdOriginAccessFirstAiText(
      parsed.analysis_system_code ||
      parsed.analysisSystemCode
    );

  const company =
    hdOriginAccessFirstAiFindCandidate(
      companies,
      companyCode
    );

  const documentType =
    hdOriginAccessFirstAiFindCandidate(
      documentTypes,
      documentTypeCode
    );

  const specialist =
    hdOriginAccessFirstAiFindCandidate(
      specialists,
      analysisSystemCode
    );

  if (!company) {
    const error = new Error(
      "AIが会社候補外のコードを返しました: " +
      companyCode
    );

    error.statusCode = 422;
    throw error;
  }

  if (!documentType) {
    const error = new Error(
      "AIが文書種別候補外のコードを返しました: " +
      documentTypeCode
    );

    error.statusCode = 422;
    throw error;
  }

  if (!specialist) {
    const error = new Error(
      "AIが専門解析候補外のコードを返しました: " +
      analysisSystemCode
    );

    error.statusCode = 422;
    throw error;
  }

  return {
    company_code: company.code,
    company_label: company.label,
    document_type_code: documentType.code,
    document_type_label: documentType.label,
    analysis_system_code: specialist.code,
    analysis_system_label: specialist.label,
    confidence:
      hdOriginAccessFirstAiConfidence(
        parsed.confidence
      ),
    reason:
      hdOriginAccessFirstAiText(
        parsed.reason
      ),
    needs_review:
      parsed.needs_review === true ||
      parsed.needsReview === true,
    warnings:
      hdOriginAccessFirstAiWarnings(
        parsed.warnings
      ),
    model: getOpenAiModel(),
    prompt_version:
      "access-first-decision-v1",
    raw_result: parsed,
    usage:
      response && response.usage
        ? response.usage
        : null
  };
}
/* HD_ORIGIN_ACCESS_FIRST_AI_20260718_END */

async function handlePaymentDocumentRoutes(req, res) {
  /* HD_ORIGIN_ACCESS_FIRST_AI_ROUTE_20260718 */
  if (
    req.method === "POST" &&
    String(req.url || "").split("?")[0] ===
      "/api/payment-documents/access-ai/first-decision"
  ) {
    try {
      const body =
        await readBody(req);

      const decision =
        await createHdOriginAccessFirstAiDecision(
          body
        );

      sendJson(res, 200, {
        ok: true,
        source:
          "access_openai_first_decision_text_only",
        image_used: false,
        access_ocr_id:
          body.access_ocr_id ||
          body.accessOcrId ||
          null,
        company_code:
          decision.company_code,
        company_label:
          decision.company_label,
        document_type_code:
          decision.document_type_code,
        document_type_label:
          decision.document_type_label,
        analysis_system_code:
          decision.analysis_system_code,
        analysis_system_label:
          decision.analysis_system_label,
        confidence:
          decision.confidence,
        reason:
          decision.reason,
        needs_review:
          decision.needs_review,
        warnings:
          decision.warnings,
        warnings_json:
          JSON.stringify(
            decision.warnings || []
          ),
        model:
          decision.model,
        prompt_version:
          decision.prompt_version,
        raw_result:
          decision.raw_result,
        usage:
          decision.usage
      });
    } catch (error) {
      sendJson(
        res,
        error.statusCode || 500,
        {
          ok: false,
          source:
            "access_openai_first_decision_text_only",
          image_used: false,
          error:
            error.message ||
            String(error)
        }
      );
    }

    return true;
  }

  /* HD_ORIGIN_ACCESS_AI_SPECIALIST_ROUTE_20260715_START */
  if (
    req.method === "POST" &&
    String(req.url || "").split("?")[0] ===
      "/api/payment-documents/access-ai-specialist"
  ) {
    try {
      const body = await readBody(req);
      const ocrText = String(
        body.ocr_text ||
        body.ocrText ||
        ""
      ).trim();

      if (!ocrText) {
        sendJson(res, 400, {
          ok: false,
          source: "access_openai_ocr_text_only",
          image_used: false,
          error: "OCR text is empty."
        });
        return true;
      }

      if (ocrText.length > 50000) {
        sendJson(res, 400, {
          ok: false,
          source: "access_openai_ocr_text_only",
          image_used: false,
          error: "OCR text is too long."
        });
        return true;
      }

      const specialistRouteCode = String(
        body.specialist_route_code ||
        body.specialistRouteCode ||
        body.group ||
        ""
      )
        .trim()
        .toLowerCase()
        .replace(/_analysis$/, "");

      const definitions = {
        invoice_payable: {
          analysisSystemCode: "invoice_payable_analysis"
        },
        tax_public: {
          analysisSystemCode: "tax_public_analysis"
        },
        utility_communication: {
          analysisSystemCode: "utility_communication_analysis"
        },
        contract_insurance_lease: {
          analysisSystemCode: "contract_insurance_lease_analysis"
        },
        card_statement: {
          analysisSystemCode: "card_statement_analysis"
        },
        reference_check: {
          analysisSystemCode: "reference_check_analysis"
        },
        needs_review: {
          analysisSystemCode: "needs_review_analysis"
        }
      };

      const definition = definitions[specialistRouteCode];

      if (!definition) {
        sendJson(res, 400, {
          ok: false,
          source: "access_openai_ocr_text_only",
          image_used: false,
          error: "Unsupported specialist route code.",
          received_specialist_route_code:
            specialistRouteCode
        });
        return true;
      }

      const aiResult =
        await createPaymentDocumentSpecialistDraftFromOcrText(
          ocrText,
          {
            ...body,
            specialist_route_code:
              specialistRouteCode,
            analysis_system_code:
              body.analysis_system_code ||
              body.analysisSystemCode ||
              definition.analysisSystemCode,
            group:
              specialistRouteCode,
            draft:
              body.draft ||
              body.classification ||
              {}
          }
        );

      sendJson(res, 200, {
        ok: true,
        source: "access_openai_ocr_text_only",
        image_used: false,
        access_ocr_id:
          body.access_ocr_id ||
          body.accessOcrId ||
          null,
        specialist_route_code:
          specialistRouteCode,
        analysis_system_code:
          definition.analysisSystemCode,
        ai_steps:
          aiResult.steps,
        display_mode:
          aiResult.display_mode,
        document_group:
          aiResult.document_group,
        visible_field_labels:
          aiResult.visible_field_labels,
        prompt_rule_files:
          aiResult.prompt_rule_files,
        classification:
          aiResult.classification,
        specialist:
          aiResult.specialist,
        draft:
          aiResult.draft
      });
    } catch (error) {
      sendJson(
        res,
        error.statusCode || 500,
        {
          ok: false,
          source: "access_openai_ocr_text_only",
          image_used: false,
          error:
            error.message ||
            String(error)
        }
      );
    }

    return true;
  }
  /* HD_ORIGIN_ACCESS_AI_SPECIALIST_ROUTE_20260715_END */

  /* HD_ORIGIN_WITHHOLDING_TAX_RULE_MANAGEMENT_API_20260711_START */
  if (
    req.method === "GET" &&
    String(req.url || "").split("?")[0] ===
      "/api/payment-documents/tax-public/withholding-rules"
  ) {
    try {
      const result = await db.query(
        `
        SELECT
          c.company_id,
          c.company_code,
          c.company_name,

          COALESCE(
            r.payment_cycle_code,
            'normal'
          ) AS payment_cycle_code,

          COALESCE(
            r.special_approval_status_code,
            'not_approved'
          ) AS special_approval_status_code,

          COALESCE(
            r.special_applies_to_payable_withholding,
            FALSE
          ) AS special_applies_to_payable_withholding,

          COALESCE(
            r.effective_from,
            DATE '1900-01-01'
          ) AS effective_from,

          r.effective_to,

          COALESCE(
            r.rule_source_code,
            'system_default_normal'
          ) AS rule_source_code,

          COALESCE(
            r.memo,
            ''
          ) AS memo,

          r.created_at,
          r.updated_at,

          (
            SELECT COUNT(*)
            FROM accounting.tax_public_obligations o
            WHERE
              o.company_id = c.company_id
              AND o.source_type_code =
                'withholding_tax_ledger'
              AND o.status_code =
                'scheduled'
          )::INTEGER AS scheduled_obligation_count

        FROM expenses.companies c

        LEFT JOIN
          accounting.company_withholding_tax_rules r
          ON r.company_id = c.company_id

        ORDER BY
          c.company_id
        `
      );

      sendJson(res, 200, {
        ok: true,
        rules: result.rows
      });
    } catch (error) {
      sendJson(
        res,
        error.statusCode || 500,
        {
          ok: false,
          error:
            error.message ||
            String(error),
          code:
            error.code || null,
          detail:
            error.detail || null
        }
      );
    }

    return true;
  }

  if (
    req.method === "POST" &&
    String(req.url || "").split("?")[0] ===
      "/api/payment-documents/tax-public/withholding-rules/save"
  ) {
    try {
      const body =
        await readBody(req);

      const companyId =
        Number(body.company_id || 0);

      const paymentCycleCode =
        String(
          body.payment_cycle_code || ""
        ).trim();

      const approvalStatusCode =
        String(
          body.special_approval_status_code || ""
        ).trim();

      const specialApplies =
        body.special_applies_to_payable_withholding ===
          true;

      const effectiveFrom =
        String(
          body.effective_from || ""
        ).trim();

      const effectiveTo =
        String(
          body.effective_to || ""
        ).trim();

      const memo =
        String(body.memo || "").trim();

      if (!Number.isInteger(companyId) || companyId <= 0) {
        sendJson(res, 400, {
          ok: false,
          error:
            "company_idが不正です。"
        });

        return true;
      }

      if (
        ![
          "normal",
          "special"
        ].includes(paymentCycleCode)
      ) {
        sendJson(res, 400, {
          ok: false,
          error:
            "payment_cycle_codeが不正です。"
        });

        return true;
      }

      if (
        ![
          "not_approved",
          "pending",
          "approved",
          "revoked"
        ].includes(approvalStatusCode)
      ) {
        sendJson(res, 400, {
          ok: false,
          error:
            "special_approval_status_codeが不正です。"
        });

        return true;
      }

      if (
        paymentCycleCode === "special" &&
        (
          approvalStatusCode !== "approved" ||
          specialApplies !== true
        )
      ) {
        sendJson(res, 400, {
          ok: false,
          error:
            "納期の特例を使用するには、承認済みかつ源泉預り金への適用が必要です。"
        });

        return true;
      }

      if (
        paymentCycleCode === "normal" &&
        specialApplies === true
      ) {
        sendJson(res, 400, {
          ok: false,
          error:
            "通常納付では特例適用を有効にできません。"
        });

        return true;
      }

      const companyExists =
        await db.query(
          `
          SELECT company_id
          FROM expenses.companies
          WHERE company_id = $1
          `,
          [companyId]
        );

      if (!companyExists.rows.length) {
        sendJson(res, 404, {
          ok: false,
          error:
            "対象会社がありません。"
        });

        return true;
      }

      const saveResult =
        await db.query(
          `
          INSERT INTO
            accounting.company_withholding_tax_rules (
              company_id,
              payment_cycle_code,
              special_approval_status_code,
              special_applies_to_payable_withholding,
              effective_from,
              effective_to,
              rule_source_code,
              memo
            )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            COALESCE(
              NULLIF($5, '')::DATE,
              DATE '1900-01-01'
            ),
            NULLIF($6, '')::DATE,
            'company_setting',
            $7
          )

          ON CONFLICT (company_id)
          DO UPDATE SET
            payment_cycle_code =
              EXCLUDED.payment_cycle_code,

            special_approval_status_code =
              EXCLUDED.special_approval_status_code,

            special_applies_to_payable_withholding =
              EXCLUDED.special_applies_to_payable_withholding,

            effective_from =
              EXCLUDED.effective_from,

            effective_to =
              EXCLUDED.effective_to,

            rule_source_code =
              EXCLUDED.rule_source_code,

            memo =
              EXCLUDED.memo,

            updated_at = NOW()

          RETURNING *
          `,
          [
            companyId,
            paymentCycleCode,
            approvalStatusCode,
            specialApplies,
            effectiveFrom,
            effectiveTo,
            memo
          ]
        );

      const dueDateResult =
        await db.query(
          `
          SELECT *
          FROM accounting.calculate_withholding_tax_due_dates()
          `
        );

      const bankResult =
        await db.query(
          `
          SELECT *
          FROM accounting.reconcile_withholding_tax_bank_transactions()
          `
        );

      sendJson(res, 200, {
        ok: true,
        rule: saveResult.rows[0],
        dueDateCalculation:
          dueDateResult.rows[0] || null,
        bankReconciliation:
          bankResult.rows[0] || null
      });
    } catch (error) {
      sendJson(
        res,
        error.statusCode || 500,
        {
          ok: false,
          error:
            error.message ||
            String(error),
          code:
            error.code || null,
          detail:
            error.detail || null
        }
      );
    }

    return true;
  }

  if (
    req.method === "POST" &&
    String(req.url || "").split("?")[0] ===
      "/api/payment-documents/tax-public/withholding-rules/recalculate"
  ) {
    try {
      const registrationResult =
        await db.query(
          `
          SELECT *
          FROM accounting.register_withholding_tax_obligations()
          `
        );

      const dueDateResult =
        await db.query(
          `
          SELECT *
          FROM accounting.calculate_withholding_tax_due_dates()
          `
        );

      const bankResult =
        await db.query(
          `
          SELECT *
          FROM accounting.reconcile_withholding_tax_bank_transactions()
          `
        );

      sendJson(res, 200, {
        ok: true,
        registration:
          registrationResult.rows[0] || null,
        dueDateCalculation:
          dueDateResult.rows[0] || null,
        bankReconciliation:
          bankResult.rows[0] || null
      });
    } catch (error) {
      sendJson(
        res,
        error.statusCode || 500,
        {
          ok: false,
          error:
            error.message ||
            String(error),
          code:
            error.code || null,
          detail:
            error.detail || null
        }
      );
    }

    return true;
  }

  if (
    req.method === "GET" &&
    String(req.url || "").split("?")[0] ===
      "/api/payment-documents/tax-public/withholding-rules/self-test"
  ) {
    try {
      const result = await db.query(
        `
        WITH tests AS (
          SELECT
            'normal_basic'::TEXT
              AS test_code,
            DATE '2026-06-15'
              AS recognition_date,
            'normal'::TEXT
              AS payment_cycle_code,
            'not_approved'::TEXT
              AS approval_code,
            FALSE
              AS special_applies,
            DATE '2026-07-10'
              AS expected_due_date

          UNION ALL

          SELECT
            'normal_weekend_adjustment',
            DATE '2026-04-15',
            'normal',
            'not_approved',
            FALSE,
            DATE '2026-05-11'

          UNION ALL

          SELECT
            'special_first_half',
            DATE '2026-06-15',
            'special',
            'approved',
            TRUE,
            DATE '2026-07-10'

          UNION ALL

          SELECT
            'special_second_half',
            DATE '2026-07-15',
            'special',
            'approved',
            TRUE,
            DATE '2027-01-20'

          UNION ALL

          SELECT
            'special_not_approved_falls_back_normal',
            DATE '2026-06-15',
            'special',
            'pending',
            TRUE,
            DATE '2026-07-10'
        )

        SELECT
          t.test_code,
          t.recognition_date,
          t.payment_cycle_code,
          t.approval_code,
          t.special_applies,
          d.raw_due_date,
          d.calculated_due_date,
          d.applied_rule_code,
          d.calendar_complete,
          t.expected_due_date,
          (
            d.calculated_due_date =
              t.expected_due_date
          ) AS passed

        FROM tests t

        CROSS JOIN LATERAL
          accounting.calculate_withholding_tax_due_date_by_rule(
            t.recognition_date,
            t.payment_cycle_code,
            t.approval_code,
            t.special_applies
          ) d

        ORDER BY t.test_code
        `
      );

      const passedCount =
        result.rows.filter(
          row => row.passed === true
        ).length;

      sendJson(res, 200, {
        ok:
          passedCount ===
          result.rows.length,
        totalCount:
          result.rows.length,
        passedCount,
        failedCount:
          result.rows.length -
          passedCount,
        tests:
          result.rows
      });
    } catch (error) {
      sendJson(
        res,
        error.statusCode || 500,
        {
          ok: false,
          error:
            error.message ||
            String(error),
          code:
            error.code || null,
          detail:
            error.detail || null
        }
      );
    }

    return true;
  }
  /* HD_ORIGIN_WITHHOLDING_TAX_RULE_MANAGEMENT_API_20260711_END */
  /* HD_ORIGIN_TAX_PUBLIC_WITHHOLDING_CANDIDATES_API_20260711_START */
  if (
    req.method === "GET" &&
    String(req.url || "").split("?")[0] ===
      "/api/payment-documents/tax-public/withholding-candidates"
  ) {
    try {
      const requestUrl = new URL(
        String(req.url || ""),
        "http://localhost"
      );

      const companyIdText = String(
        requestUrl.searchParams.get(
          "company_id"
        ) || ""
      ).trim();

      const companyId =
        /^[0-9]+$/.test(companyIdText)
          ? Number(companyIdText)
          : null;

      const registrationResult =
        await db.query(
          `
          SELECT *
          FROM accounting.register_withholding_tax_obligations()
          `
        );

      const dueDateResult =
        await db.query(
          `
          SELECT *
          FROM accounting.calculate_withholding_tax_due_dates()
          `
        );

      const bankReconciliationResult =
        await db.query(
          `
          SELECT *
          FROM accounting.reconcile_withholding_tax_bank_transactions()
          `
        );

      const params = [];
      const conditions = [
        "source_type_code = 'withholding_tax_ledger'"
      ];

      if (companyId) {
        params.push(companyId);

        conditions.push(
          "company_id = $" +
          params.length
        );
      }

      const result = await db.query(
        `
        SELECT
          tax_public_obligation_id,
          company_id,
          company_code,
          company_name,
          source_type_code,
          source_key
            AS tax_public_source_key,
          tax_item_code,
          tax_item_name,
          source_ledger_id
            AS withholding_tax_ledger_id,
          payable_id,
          payable_payment_id,
          counterparty_name,
          recognition_date,
          due_date
            AS tax_public_due_date,
          payment_amount,
          currency_code,
          status_code
            AS tax_public_status_code,
          scheduled_at,
          paid_at,
          paid_reference,
          machine_validation_status,
          machine_validation_message,
          created_at,
          updated_at,
          '源泉預り金台帳'
            AS source_type_name
        FROM
          accounting.v_tax_public_obligations
        WHERE
          ${conditions.join(" AND ")}
        ORDER BY
          CASE status_code
            WHEN 'error' THEN 1
            WHEN 'scheduled' THEN 2
            WHEN 'paid' THEN 3
            ELSE 4
          END,
          due_date NULLS LAST,
          recognition_date,
          tax_public_obligation_id
        `,
        params
      );

      const summary = result.rows.reduce(
        (current, row) => {
          const amount =
            Number(row.payment_amount || 0);

          current.count += 1;

          if (row.tax_public_status_code === "scheduled") {
            current.scheduledCount += 1;
            current.scheduledAmount +=
              Number.isFinite(amount)
                ? amount
                : 0;
          }

          if (row.tax_public_status_code === "paid") {
            current.paidCount += 1;
            current.paidAmount +=
              Number.isFinite(amount)
                ? amount
                : 0;
          }

          if (
            row.machine_validation_status ===
            "error"
          ) {
            current.errorCount += 1;
          }

          return current;
        },
        {
          count: 0,
          totalAmount: 0,
          scheduledCount: 0,
          scheduledAmount: 0,
          paidCount: 0,
          paidAmount: 0,
          errorCount: 0,
          currencyCode: "JPY"
        }
      );

      summary.totalAmount =
        summary.scheduledAmount +
        summary.paidAmount;

      sendJson(res, 200, {
        ok: true,
        registration:
          registrationResult.rows[0] || null,

        dueDateCalculation:
          dueDateResult.rows[0] || null,

        bankReconciliation:
          bankReconciliationResult.rows[0] || null,

        candidates: result.rows,
        summary
      });
    } catch (error) {
      sendJson(
        res,
        error.statusCode || 500,
        {
          ok: false,
          error:
            error.message ||
            String(error),
          code:
            error.code || null,
          detail:
            error.detail || null
        }
      );
    }

    return true;
  }

  if (
    req.method === "POST" &&
    String(req.url || "").split("?")[0] ===
      "/api/payment-documents/tax-public/withholding-payment-complete"
  ) {
    try {
      const body =
        await readBody(req);

      const obligationId =
        Number(
          body.tax_public_obligation_id || 0
        );

      const sourceKey =
        String(
          body.tax_public_source_key || ""
        ).trim();

      const paidReference =
        String(
          body.paid_reference || ""
        ).trim();

      if (
        !Number.isInteger(obligationId) &&
        !sourceKey
      ) {
        sendJson(res, 400, {
          ok: false,
          error:
            "tax_public_obligation_idまたはtax_public_source_keyが必要です。"
        });

        return true;
      }

      const params = [];
      const conditions = [];

      if (Number.isInteger(obligationId)) {
        params.push(obligationId);

        conditions.push(
          "tax_public_obligation_id = $" +
          params.length
        );
      }

      if (sourceKey) {
        params.push(sourceKey);

        conditions.push(
          "source_key = $" +
          params.length
        );
      }

      params.push(
        paidReference || null
      );

      const paidReferenceParam =
        "$" + params.length;

      const result = await db.query(
        `
        UPDATE
          accounting.tax_public_obligations
        SET
          status_code = 'paid',
          paid_at = NOW(),
          paid_reference =
            COALESCE(
              ${paidReferenceParam},
              paid_reference
            ),
          machine_validation_status =
            'valid',
          machine_validation_message =
            NULL,
          updated_at = NOW()
        WHERE
          source_type_code =
            'withholding_tax_ledger'
          AND ${conditions.join(" AND ")}
          AND status_code <> 'cancelled'
        RETURNING
          tax_public_obligation_id,
          company_id,
          source_key,
          source_ledger_id,
          payable_id,
          payable_payment_id,
          payment_amount,
          currency_code,
          status_code,
          paid_at,
          paid_reference
        `,
        params
      );

      if (!result.rows.length) {
        sendJson(res, 404, {
          ok: false,
          error:
            "対象の源泉所得税納付予定が見つかりません。"
        });

        return true;
      }

      sendJson(res, 200, {
        ok: true,
        payment: result.rows[0],
        ledgerSynced: true
      });
    } catch (error) {
      sendJson(
        res,
        error.statusCode || 500,
        {
          ok: false,
          error:
            error.message ||
            String(error),
          code:
            error.code || null,
          detail:
            error.detail || null
        }
      );
    }

    return true;
  }
  /* HD_ORIGIN_TAX_PUBLIC_WITHHOLDING_CANDIDATES_API_20260711_END */

  /* HD_ORIGIN_BUSINESS_FLOW_AI_ROUTE_20260709_HANDLER_START */
  if (req.method === "POST" && String(req.url || "").split("?")[0] === "/api/payment-documents/business-flow-ai/analyze") {
    try {
      const body = await readBody(req);
      const sourceText = hdOriginBusinessFlowCleanText(body.text || body.input || body.memo || "", 20000);

      if (!sourceText) {
        sendJson(res, 400, {
          ok: false,
          error: "AI解析する業務フロー入力が空です。"
        });
        return true;
      }

      const analysis = await hdOriginAnalyzeBusinessFlowWithOpenAi(sourceText);
      const saved = body.save === false ? null : hdOriginSaveBusinessFlowRules(sourceText, analysis);

      sendJson(res, 200, {
        ok: true,
        message: "業務フロー入力をAI解析しました。",
        analysis,
        saved
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, {
        ok: false,
        error: err.message || String(err)
      });
    }

    return true;
  }
    /* HD_ORIGIN_BUSINESS_FLOW_AI_SUGGEST_HANDLER_20260709_START */
  if (req.method === "POST" && String(req.url || "").split("?")[0] === "/api/payment-documents/business-flow-ai/suggest") {
    try {
      const body = await readBody(req);
      const suggestions = await hdOriginSuggestBusinessFlowImprovements(body);

      sendJson(res, 200, {
        ok: true,
        message: "業務フロー改善提案を作成しました。",
        suggestions
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, {
        ok: false,
        error: err.message || String(err)
      });
    }

    return true;
  }
  /* HD_ORIGIN_BUSINESS_FLOW_AI_SUGGEST_HANDLER_20260709_END */
/* HD_ORIGIN_BUSINESS_FLOW_AI_ROUTE_20260709_HANDLER_END */
  /* HD_ORIGIN_PAYMENT_DOCUMENT_REVIEW_ITEMS_DB_ONLY_20260708_START */
  if (req.method === "GET" && String(req.url || "").split("?")[0] === "/api/payment-documents/review-items") {
    try {
      const result = await db.query(`
        SELECT
          o.payment_document_ocr_import_id,
          o.original_file_name,
          o.saved_file_name,
          o.mime_type,
          o.size_bytes,
          o.sha256,
          o.document_type,
          o.destination,
          o.source_type,
          o.vendor_name,
          o.note,
          o.email_subject,
          o.email_from,
          o.email_received_at,
          o.ocr_status,
          o.ocr_provider,
          o.ocr_api_version,
          o.ocr_at,
          o.ocr_raw_text,
          o.ocr_text_length,
          o.process_status,
          o.save_status,
          o.evidence_saved,
          o.ocr_saved,
          o.saved_relative_path,
          o.saved_meta_relative_path,
          o.saved_at,
          o.saved_by_page,
          o.draft_status,
          o.latest_sorting_draft_id,
          o.sorted_at,
          o.created_at,
          o.updated_at,

          d.payment_document_sorting_draft_id AS d_id,
          d.draft_no AS d_no,
          d.draft_status AS d_status,
          d.human_check_status AS d_human_check_status,

          d.document_type_code AS d_document_type_code,
          d.document_type_label AS d_document_type_label,
          d.payment_destination_code AS d_payment_destination_code,
          d.payment_destination_label AS d_payment_destination_label,
          d.accounting_category_code AS d_accounting_category_code,
          d.accounting_category_label AS d_accounting_category_label,
          d.payable_kind_code AS d_payable_kind_code,
          d.payable_kind_label AS d_payable_kind_label,
          d.specialist_route_code AS d_specialist_route_code,
          d.specialist_route_label AS d_specialist_route_label,

          d.payment_target_label AS d_payment_target_label,
          d.payable_target_label AS d_payable_target_label,
          d.expense_target_label AS d_expense_target_label,
          d.tax_public_label AS d_tax_public_label,
          d.public_utility_label AS d_public_utility_label,
          d.contract_insurance_lease_label AS d_contract_insurance_lease_label,

          d.ai_confidence AS d_ai_confidence,
          d.ai_confidence_label AS d_ai_confidence_label,
          d.ai_reason AS d_ai_reason,
          d.review_reason AS d_review_reason,
          d.needs_review AS d_needs_review,
          d.ai_summary_json AS d_ai_summary_json,
          d.sort_result_json AS d_sort_result_json,
          d.visible_fields_json AS d_visible_fields_json,
          d.warnings_json AS d_warnings_json,
          d.display_rotation AS d_display_rotation,
          d.memo AS d_memo,
          d.created_at AS d_created_at,
          d.updated_at AS d_updated_at,
          d.issue_date AS d_issue_date
        FROM accounting.payment_document_ocr_imports o
        LEFT JOIN accounting.payment_document_sorting_drafts d
          ON d.payment_document_sorting_draft_id = o.latest_sorting_draft_id
         AND d.deleted_at IS NULL
        WHERE o.deleted_at IS NULL
          AND COALESCE(o.ocr_raw_text, '') <> ''
        ORDER BY
          o.sorted_at DESC NULLS LAST,
          o.saved_at DESC NULLS LAST,
          o.ocr_at DESC NULLS LAST,
          o.payment_document_ocr_import_id DESC
        LIMIT 500
      `);

      const items = result.rows.map(row => {
        const latestSortingDraft = row.d_id ? {
          paymentDocumentSortingDraftId: row.d_id,
          paymentDocumentOcrImportId: row.payment_document_ocr_import_id,
          draftNo: row.d_no,
          draftStatus: row.d_status,
          humanCheckStatus: row.d_human_check_status,

          documentTypeCode: row.d_document_type_code,
          documentTypeLabel: row.d_document_type_label,
          paymentDestinationCode: row.d_payment_destination_code,
          paymentDestinationLabel: row.d_payment_destination_label,
          accountingCategoryCode: row.d_accounting_category_code,
          accountingCategoryLabel: row.d_accounting_category_label,
          payableKindCode: row.d_payable_kind_code,
          payableKindLabel: row.d_payable_kind_label,
          specialistRouteCode: row.d_specialist_route_code,
          specialistRouteLabel: row.d_specialist_route_label,

          paymentTargetLabel: row.d_payment_target_label,
          payableTargetLabel: row.d_payable_target_label,
          expenseTargetLabel: row.d_expense_target_label,
          taxPublicLabel: row.d_tax_public_label,
          publicUtilityLabel: row.d_public_utility_label,
          contractInsuranceLeaseLabel: row.d_contract_insurance_lease_label,

          aiConfidence: row.d_ai_confidence,
          aiConfidenceLabel: row.d_ai_confidence_label,
          aiReason: row.d_ai_reason,
          reviewReason: row.d_review_reason,
          needsReview: !!row.d_needs_review,

          aiSummary: row.d_ai_summary_json || {},
          sortResult: row.d_sort_result_json || {},
          visibleFields: row.d_visible_fields_json || {},
          warnings: row.d_warnings_json || [],

          displayRotation: row.d_display_rotation,
          memo: row.d_memo,
          createdAt: row.d_created_at,
          updatedAt: row.d_updated_at,
          issueDate: row.d_issue_date
        } : null;

        const baseDraft = latestSortingDraft || {};
        const baseSort = baseDraft.sortResult || {};

        const aiDraft = latestSortingDraft ? Object.assign({}, baseSort, {
          document_type_code: baseDraft.documentTypeCode || baseSort.document_type_code || "",
          document_type_name: baseDraft.documentTypeLabel || baseSort.document_type_name || baseSort.document_type_label || "",
          document_type_label: baseDraft.documentTypeLabel || baseSort.document_type_label || baseSort.document_type_name || "",

          payment_destination_code: baseDraft.paymentDestinationCode || baseSort.payment_destination_code || "",
          payment_destination_name: baseDraft.paymentDestinationLabel || baseSort.payment_destination_name || baseSort.payment_destination_label || "",
          payment_destination_label: baseDraft.paymentDestinationLabel || baseSort.payment_destination_label || baseSort.payment_destination_name || "",

          accounting_category_code: baseDraft.accountingCategoryCode || baseSort.accounting_category_code || "",
          accounting_category_name: baseDraft.accountingCategoryLabel || baseSort.accounting_category_name || baseSort.accounting_category_label || "",
          accounting_category_label: baseDraft.accountingCategoryLabel || baseSort.accounting_category_label || baseSort.accounting_category_name || "",

          issue_date: baseDraft.issueDate || baseDraft.issue_date || baseSort.issue_date || (baseDraft.aiSummary && baseDraft.aiSummary.issue_date) || (baseSort.ai_summary && baseSort.ai_summary.issue_date) || "",

          payable_kind_code: baseDraft.payableKindCode || baseSort.payable_kind_code || "",
          payable_kind_name: baseDraft.payableKindLabel || baseSort.payable_kind_name || baseSort.payable_kind_label || "",
          payable_kind_label: baseDraft.payableKindLabel || baseSort.payable_kind_label || baseSort.payable_kind_name || "",

          specialist_route_code: baseDraft.specialistRouteCode || baseSort.specialist_route_code || "",
          specialist_route_label: baseDraft.specialistRouteLabel || baseSort.specialist_route_label || "",

          payment_target: baseDraft.paymentTargetLabel || baseSort.payment_target || "",
          payable_target: baseDraft.payableTargetLabel || baseSort.payable_target || "",
          expense_target: baseDraft.expenseTargetLabel || baseSort.expense_target || "",
          tax_public: baseDraft.taxPublicLabel || baseSort.tax_public || "",
          public_utility: baseDraft.publicUtilityLabel || baseSort.public_utility || "",
          contract_insurance_lease: baseDraft.contractInsuranceLeaseLabel || baseSort.contract_insurance_lease || "",

          ai_confidence: baseDraft.aiConfidence || baseDraft.aiConfidenceLabel || baseSort.ai_confidence || baseSort.confidence_label || "",
          confidence_label: baseDraft.aiConfidenceLabel || baseDraft.aiConfidence || baseSort.confidence_label || "",
          review_reason: baseDraft.reviewReason || baseDraft.aiReason || baseSort.review_reason || baseSort.reason || "",
          reason: baseDraft.aiReason || baseDraft.reviewReason || baseSort.reason || baseSort.review_reason || "",
          needs_review: !!(baseDraft.needsReview || baseSort.needs_review)
        }) : null;

        const visibleFieldLabels = latestSortingDraft ? [
          "書類区分",
          "処理先",
          "会計区分",
          "未払種別",
          "専門ルート",
          "支払対象",
          "未払登録対象",
          "経費登録対象",
          "税金・公的支払",
          "公共料金・通信費",
          "契約・保険・リース",
          "AI信頼度",
          "AI判定理由"
        ] : [];

        return {
          source: "database-review-items",
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
          latestSortingDraftId: row.latest_sorting_draft_id,
          sortedAt: row.sorted_at,
          latestSortingDraft,

          __savedSortingDraft: latestSortingDraft,
          __sortingDraftSaved: !!latestSortingDraft,
          __aiDraft: aiDraft,
          __visibleFieldLabels: visibleFieldLabels,
          __documentGroup: latestSortingDraft
            ? (latestSortingDraft.specialistRouteCode || latestSortingDraft.paymentDestinationCode || latestSortingDraft.documentTypeCode || "")
            : "",
          __aiRawResult: latestSortingDraft ? {
            ok: true,
            source: "db_latest_sorting_draft",
            draft: aiDraft,
            visible_field_labels: visibleFieldLabels
          } : null,

          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      });

      sendJson(res, 200, {
        ok: true,
        source: "database-review-items",
        items
      });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        source: "database-review-items",
        error: err.message || String(err)
      });
    }

    return true;
  }
  /* HD_ORIGIN_PAYMENT_DOCUMENT_REVIEW_ITEMS_DB_ONLY_20260708_END */
  /* HD_ORIGIN_PAYMENT_DOCUMENT_SORTING_DRAFT_READ_ROUTE_20260707_START */
  if (req.method === "GET" && String(req.url || "").split("?")[0].startsWith("/api/payment-documents/sorting-drafts/by-ocr-import/")) {
    try {
      const routePath = String(req.url || "").split("?")[0];
      const idText = decodeURIComponent(routePath.replace("/api/payment-documents/sorting-drafts/by-ocr-import/", "")).trim();
      const id = Number(idText);

      const draft = await hdOriginGetPaymentDocumentSortingDraftByOcrImportId(id);

      sendJson(res, 200, {
        ok: true,
        found: !!draft,
        draft
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, {
        ok: false,
        error: err.message || String(err)
      });
    }

    return true;
  }
  /* HD_ORIGIN_PAYMENT_DOCUMENT_SORTING_DRAFT_READ_ROUTE_20260707_END */

  /* HD_ORIGIN_GPT2_SPECIALIST_ANALYSIS_RESULT_SAVE_ROUTE_20260710_START */
  function hdOriginSpecialistSaveText(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
  }

  function hdOriginSpecialistSaveNumber(value) {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function hdOriginSpecialistSaveObject(value) {
    if (!value || typeof value !== "object") return {};
    return value;
  }

  function hdOriginSpecialistSaveArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function hdOriginSpecialistFirstObject() {
    for (const value of arguments) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value;
      }
    }
    return {};
  }

  function hdOriginSpecialistFirstText() {
    for (const value of arguments) {
      const text = hdOriginSpecialistSaveText(value);
      if (text) return text;
    }
    return null;
  }

  async function hdOriginSavePaymentDocumentSpecialistAnalysisResult(body) {
    const root = hdOriginSpecialistFirstObject(body);
    const draft = hdOriginSpecialistFirstObject(root.draft, root.aiDraft, root.ai_draft, root.sorting, root.classification);
    const sortResult = hdOriginSpecialistFirstObject(root.sortResult, root.sort_result, root.result, draft.sortResult, draft.sort_result);
    const aiSummary = hdOriginSpecialistFirstObject(root.ai_summary, root.aiSummary, draft.ai_summary, draft.aiSummary, sortResult.ai_summary, sortResult.aiSummary);

    let ocrImportId = hdOriginSpecialistSaveNumber(
      root.paymentDocumentOcrImportId ||
      root.payment_document_ocr_import_id ||
      root.ocrImportId ||
      root.ocr_import_id ||
      root.id
    );

    let sortingDraftId = hdOriginSpecialistSaveNumber(
      root.paymentDocumentSortingDraftId ||
      root.payment_document_sorting_draft_id ||
      root.sortingDraftId ||
      root.sorting_draft_id ||
      root.draftId ||
      root.draft_id
    );

    const client = await db.connect();

    try {
      await client.query("BEGIN");

      let sortingRow = null;
      let ocrImportRow = null;
      let sortingDraftAutoCreated = false;

      const fallbackAnalysisSystemCode = hdOriginSpecialistFirstText(
        root.analysisSystemCode,
        root.analysis_system_code,
        draft.analysis_system_code,
        draft.specialist_route_code,
        sortResult.analysis_system_code,
        sortResult.specialist_route_code,
        aiSummary.analysis_system_code
      );

      const fallbackAnalysisSystemLabel = hdOriginSpecialistFirstText(
        root.analysisSystemLabel,
        root.analysis_system_label,
        draft.analysis_system_label,
        draft.specialist_route_label,
        sortResult.analysis_system_label,
        sortResult.specialist_route_label,
        aiSummary.analysis_system_label,
        aiSummary.analysis_system
      );

      const fallbackSpecialistRouteCode = hdOriginSpecialistFirstText(
        root.specialistRouteCode,
        root.specialist_route_code,
        draft.specialist_route_code,
        sortResult.specialist_route_code,
        fallbackAnalysisSystemCode
      );

      const fallbackSpecialistRouteLabel = hdOriginSpecialistFirstText(
        root.specialistRouteLabel,
        root.specialist_route_label,
        draft.specialist_route_label,
        sortResult.specialist_route_label,
        fallbackAnalysisSystemLabel
      );

      if (sortingDraftId) {
        const sortingResult = await client.query(`
          SELECT
            payment_document_sorting_draft_id,
            payment_document_ocr_import_id,
            analysis_system_code,
            analysis_system_label,
            specialist_route_code,
            specialist_route_label
          FROM accounting.payment_document_sorting_drafts
          WHERE payment_document_sorting_draft_id = $1
            AND deleted_at IS NULL
          FOR UPDATE
        `, [sortingDraftId]);

        sortingRow = sortingResult.rows[0] || null;

        if (sortingRow && !ocrImportId) {
          ocrImportId = Number(sortingRow.payment_document_ocr_import_id);
        }
      }

      if (!sortingRow && ocrImportId) {
        const ocrResult = await client.query(`
          SELECT
            payment_document_ocr_import_id,
            latest_sorting_draft_id,
            original_file_name,
            saved_file_name,
            saved_relative_path,
            sha256,
            ocr_text_length
          FROM accounting.payment_document_ocr_imports
          WHERE payment_document_ocr_import_id = $1
            AND deleted_at IS NULL
          FOR UPDATE
        `, [ocrImportId]);

        ocrImportRow = ocrResult.rows[0] || null;

        if (!ocrImportRow) {
          const err = new Error("OCR取込レコードが見つかりません。");
          err.statusCode = 404;
          throw err;
        }

        const latestSortingDraftId = hdOriginSpecialistSaveNumber(
          ocrImportRow.latest_sorting_draft_id
        );

        if (latestSortingDraftId) {
          const latestResult = await client.query(`
            SELECT
              payment_document_sorting_draft_id,
              payment_document_ocr_import_id,
              analysis_system_code,
              analysis_system_label,
              specialist_route_code,
              specialist_route_label
            FROM accounting.payment_document_sorting_drafts
            WHERE payment_document_sorting_draft_id = $1
              AND payment_document_ocr_import_id = $2
              AND deleted_at IS NULL
            FOR UPDATE
          `, [latestSortingDraftId, ocrImportId]);

          sortingRow = latestResult.rows[0] || null;
        }

        if (!sortingRow) {
          const currentResult = await client.query(`
            SELECT
              payment_document_sorting_draft_id,
              payment_document_ocr_import_id,
              analysis_system_code,
              analysis_system_label,
              specialist_route_code,
              specialist_route_label
            FROM accounting.payment_document_sorting_drafts
            WHERE payment_document_ocr_import_id = $1
              AND is_current = TRUE
              AND deleted_at IS NULL
            ORDER BY payment_document_sorting_draft_id DESC
            LIMIT 1
            FOR UPDATE
          `, [ocrImportId]);

          sortingRow = currentResult.rows[0] || null;
        }

        if (!sortingRow) {
          const documentTypeCode = hdOriginSpecialistFirstText(
            draft.document_type_code,
            draft.documentTypeCode,
            sortResult.document_type_code,
            sortResult.documentTypeCode
          );

          const documentTypeLabel = hdOriginSpecialistFirstText(
            draft.document_type_label,
            draft.documentTypeLabel,
            draft.document_type,
            draft.documentType,
            sortResult.document_type_label,
            sortResult.documentTypeLabel,
            sortResult.document_type,
            sortResult.documentType
          );

          const paymentDestinationCode = hdOriginSpecialistFirstText(
            draft.payment_destination_code,
            draft.paymentDestinationCode,
            sortResult.payment_destination_code,
            sortResult.paymentDestinationCode
          );

          const paymentDestinationLabel = hdOriginSpecialistFirstText(
            draft.payment_destination_label,
            draft.paymentDestinationLabel,
            draft.destination,
            sortResult.payment_destination_label,
            sortResult.paymentDestinationLabel,
            sortResult.destination
          );

          const accountingCategoryCode = hdOriginSpecialistFirstText(
            draft.accounting_category_code,
            draft.accountingCategoryCode,
            sortResult.accounting_category_code,
            sortResult.accountingCategoryCode
          );

          const accountingCategoryLabel = hdOriginSpecialistFirstText(
            draft.accounting_category_label,
            draft.accountingCategoryLabel,
            draft.accounting_category,
            draft.accountingCategory,
            sortResult.accounting_category_label,
            sortResult.accountingCategoryLabel
          );

          const payableKindCode = hdOriginSpecialistFirstText(
            draft.payable_kind_code,
            draft.payableKindCode,
            sortResult.payable_kind_code,
            sortResult.payableKindCode
          );

          const payableKindLabel = hdOriginSpecialistFirstText(
            draft.payable_kind_label,
            draft.payableKindLabel,
            draft.payable_kind,
            draft.payableKind,
            sortResult.payable_kind_label,
            sortResult.payableKindLabel
          );

          const paymentTargetLabel = hdOriginSpecialistFirstText(
            draft.payment_target_label,
            draft.paymentTargetLabel,
            draft.payable_flag,
            draft.payment_target
          );

          const payableTargetLabel = hdOriginSpecialistFirstText(
            draft.payable_target_label,
            draft.payableTargetLabel,
            draft.unpaid_flag,
            draft.payable_target
          );

          const expenseTargetLabel = hdOriginSpecialistFirstText(
            draft.expense_target_label,
            draft.expenseTargetLabel,
            draft.expense_flag,
            draft.expense_target
          );

          const taxPublicLabel = hdOriginSpecialistFirstText(
            draft.tax_public_label,
            draft.taxPublicLabel,
            draft.tax_public_flag
          );

          const publicUtilityLabel = hdOriginSpecialistFirstText(
            draft.public_utility_label,
            draft.publicUtilityLabel
          );

          const contractInsuranceLeaseLabel = hdOriginSpecialistFirstText(
            draft.contract_insurance_lease_label,
            draft.contractInsuranceLeaseLabel,
            draft.contract_flag
          );

          const initialAiConfidence = hdOriginSpecialistFirstText(
            draft.ai_confidence,
            draft.confidence,
            sortResult.ai_confidence,
            sortResult.confidence
          );

          const initialAiReason = hdOriginSpecialistFirstText(
            draft.ai_reason,
            draft.reason,
            sortResult.ai_reason,
            sortResult.reason,
            aiSummary.reason
          );

          const initialWarnings = hdOriginSpecialistSaveArray(
            root.warnings ||
            draft.warnings ||
            sortResult.warnings
          );

          const initialVisibleFields = hdOriginSpecialistSaveObject(
            root.visibleFields ||
            root.visible_fields ||
            root.visible_fields_json ||
            draft.visibleFields ||
            draft.visible_fields ||
            draft.visible_fields_json
          );

          const draftNo =
            "AUTO-SPECIALIST-" +
            String(ocrImportId) +
            "-" +
            String(Date.now());

          const insertedSorting = await client.query(`
            INSERT INTO accounting.payment_document_sorting_drafts (
              payment_document_ocr_import_id,
              draft_no,
              draft_version,
              is_current,
              draft_status,
              human_check_status,
              document_type_code,
              document_type_label,
              payment_destination_code,
              payment_destination_label,
              accounting_category_code,
              accounting_category_label,
              payable_kind_code,
              payable_kind_label,
              specialist_route_code,
              specialist_route_label,
              payment_target_label,
              payable_target_label,
              expense_target_label,
              tax_public_label,
              public_utility_label,
              contract_insurance_lease_label,
              ai_confidence,
              ai_confidence_label,
              ai_reason,
              ai_summary_json,
              sort_result_json,
              visible_fields_json,
              warnings_json,
              original_file_name,
              saved_file_name,
              saved_relative_path,
              sha256,
              ocr_text_length,
              created_by_page,
              created_by,
              updated_by,
              analysis_system_code,
              analysis_system_label,
              analysis_system_reason,
              analysis_system_confidence,
              specialist_analysis_status,
              created_at,
              updated_at
            ) VALUES (
              $1,$2,1,TRUE,'draft','unchecked',
              $3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
              $13,$14,$15,$16,$17,$18,$19,$19,$20,
              $21::jsonb,$22::jsonb,$23::jsonb,$24::jsonb,
              $25,$26,$27,$28,$29,
              'payment-document-specialist-auto-save',
              'specialist-analysis-results/save',
              'specialist-analysis-results/save',
              $30,$31,$32,$33,
              $34,
              now(),now()
            )
            RETURNING
              payment_document_sorting_draft_id,
              payment_document_ocr_import_id,
              analysis_system_code,
              analysis_system_label,
              specialist_route_code,
              specialist_route_label
          `, [
            ocrImportId,
            draftNo,
            documentTypeCode,
            documentTypeLabel,
            paymentDestinationCode,
            paymentDestinationLabel,
            accountingCategoryCode,
            accountingCategoryLabel,
            payableKindCode,
            payableKindLabel,
            fallbackSpecialistRouteCode,
            fallbackSpecialistRouteLabel,
            paymentTargetLabel,
            payableTargetLabel,
            expenseTargetLabel,
            taxPublicLabel,
            publicUtilityLabel,
            contractInsuranceLeaseLabel,
            initialAiConfidence,
            initialAiReason,
            JSON.stringify(aiSummary || {}),
            JSON.stringify(sortResult || {}),
            JSON.stringify(initialVisibleFields || {}),
            JSON.stringify(initialWarnings),
            String(ocrImportRow.original_file_name || ""),
            String(ocrImportRow.saved_file_name || ""),
            String(ocrImportRow.saved_relative_path || ""),
            String(ocrImportRow.sha256 || ""),
            Number(ocrImportRow.ocr_text_length || 0),
            fallbackAnalysisSystemCode || null,
            fallbackAnalysisSystemLabel || null,
            initialAiReason || null,
            initialAiConfidence || null,
            "未解析"
          ]);

          sortingRow = insertedSorting.rows[0] || null;
          sortingDraftAutoCreated = true;

          if (!sortingRow) {
            throw new Error("仕分け土台レコードの自動作成に失敗しました。");
          }
        }
      }

      if (!sortingRow) {
        const err = new Error(
          "専門解析結果を保存する仕分け土台レコードを確定できませんでした。OCR取込IDを確認してください。"
        );
        err.statusCode = 400;
        throw err;
      }

      sortingDraftId = Number(
        sortingRow.payment_document_sorting_draft_id
      );

      ocrImportId = Number(
        sortingRow.payment_document_ocr_import_id
      );

      await client.query(`
        UPDATE accounting.payment_document_ocr_imports
        SET
          latest_sorting_draft_id = $1,
          draft_status = 'draft_saved',
          sorted_at = COALESCE(sorted_at, now()),
          updated_at = now()
        WHERE payment_document_ocr_import_id = $2
          AND deleted_at IS NULL
      `, [
        sortingDraftId,
        ocrImportId
      ]);

      sortingDraftId = Number(sortingRow.payment_document_sorting_draft_id);
      ocrImportId = Number(sortingRow.payment_document_ocr_import_id);

      const analysisSystemCode = hdOriginSpecialistFirstText(
        root.analysisSystemCode,
        root.analysis_system_code,
        draft.analysis_system_code,
        draft.specialist_route_code,
        sortResult.analysis_system_code,
        sortResult.specialist_route_code,
        aiSummary.analysis_system_code,
        sortingRow.analysis_system_code,
        sortingRow.specialist_route_code
      );

      if (!analysisSystemCode) {
        const err = new Error("analysis_system_code が取得できません。1回目解析の専門解析コードを確認してください。");
        err.statusCode = 400;
        throw err;
      }

      const analysisSystemLabel = hdOriginSpecialistFirstText(
        root.analysisSystemLabel,
        root.analysis_system_label,
        draft.analysis_system_label,
        draft.specialist_route_label,
        sortResult.analysis_system_label,
        sortResult.specialist_route_label,
        aiSummary.analysis_system_label,
        aiSummary.analysis_system,
        sortingRow.analysis_system_label,
        sortingRow.specialist_route_label
      );

      const aiConfidence = hdOriginSpecialistSaveNumber(
        root.aiConfidence ||
        root.ai_confidence ||
        draft.ai_confidence ||
        draft.confidence ||
        sortResult.ai_confidence ||
        sortResult.confidence
      );

      const aiReason = hdOriginSpecialistFirstText(
        root.aiReason,
        root.ai_reason,
        root.reason,
        draft.ai_reason,
        draft.reason,
        sortResult.ai_reason,
        sortResult.reason,
        aiSummary.reason
      );

      const warningsJson = hdOriginSpecialistSaveArray(root.warnings || draft.warnings || sortResult.warnings);
      const rawResultJson = hdOriginSpecialistSaveObject(
        root.rawResult ||
        root.raw_result_json ||
        root.specialistResult ||
        root.specialist_result ||
        root.result ||
        root
      );

      const humanMemo = hdOriginSpecialistFirstText(
        root.humanMemo,
        root.human_memo,
        root.memo
      );

      const specialistStatus = hdOriginSpecialistFirstText(
        root.specialistAnalysisStatus,
        root.specialist_analysis_status
      ) || "\u4FDD\u5B58\u6E08\u307F";

      const humanConfirmStatus = hdOriginSpecialistFirstText(
        root.humanConfirmStatus,
        root.human_confirm_status
      ) || "\u672A\u78BA\u8A8D";

      await client.query(`
        UPDATE accounting.payment_document_specialist_analysis_results
        SET
          is_current = FALSE,
          updated_at = now()
        WHERE payment_document_sorting_draft_id = $1
          AND analysis_system_code = $2
          AND is_current = TRUE
          AND deleted_at IS NULL
      `, [sortingDraftId, analysisSystemCode]);

      const inserted = await client.query(`
        INSERT INTO accounting.payment_document_specialist_analysis_results (
          payment_document_ocr_import_id,
          payment_document_sorting_draft_id,
          analysis_system_code,
          analysis_system_label,
          specialist_analysis_status,
          ai_confidence,
          ai_reason,
          warnings_json,
          raw_result_json,
          human_confirm_status,
          human_memo,
          is_current,
          created_at,
          updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,TRUE,now(),now()
        )
        RETURNING
          specialist_analysis_id,
          payment_document_ocr_import_id,
          payment_document_sorting_draft_id,
          analysis_system_code,
          analysis_system_label,
          specialist_analysis_status,
          created_at,
          updated_at
      `, [
        ocrImportId,
        sortingDraftId,
        analysisSystemCode,
        analysisSystemLabel,
        specialistStatus,
        aiConfidence,
        aiReason,
        JSON.stringify(warningsJson),
        JSON.stringify(rawResultJson),
        humanConfirmStatus,
        humanMemo
      ]);

      const saved = inserted.rows[0];

      await client.query(`
        UPDATE accounting.payment_document_sorting_drafts
        SET
          latest_specialist_analysis_id = $1,
          specialist_analysis_status = $2,
          specialist_analyzed_at = now(),
          specialist_saved_at = now(),
          specialist_error_text = NULL,
          updated_at = now()
        WHERE payment_document_sorting_draft_id = $3
      `, [
        saved.specialist_analysis_id,
        specialistStatus,
        sortingDraftId
      ]);

      await client.query("COMMIT");

      return {
        saved,
        paymentDocumentOcrImportId: ocrImportId,
        paymentDocumentSortingDraftId: sortingDraftId,
        specialistAnalysisId: saved.specialist_analysis_id,
        analysisSystemCode,
        analysisSystemLabel,
        specialistAnalysisStatus: specialistStatus,
        sortingDraftAutoCreated
      };
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // 元エラーを優先
      }

      throw err;
    } finally {
      client.release();
    }
  }

  /* HD_ORIGIN_GPT2_CIL_COMBINED_SAVE_ROUTE_20260710_START */
  if (
    req.method === "POST" &&
    String(req.url || "").split("?")[0] ===
      "/api/payment-documents/contract-insurance-lease-drafts/save"
  ) {
    try {
      const body = await readBody(req);

      const specialistSaved =
        await hdOriginSavePaymentDocumentSpecialistAnalysisResult(body);

      const cilSaved =
        await hdOriginSaveContractInsuranceLeaseDraft({
          ...body,

          paymentDocumentOcrImportId:
            specialistSaved.paymentDocumentOcrImportId,

          payment_document_ocr_import_id:
            specialistSaved.paymentDocumentOcrImportId,

          paymentDocumentSortingDraftId:
            specialistSaved.paymentDocumentSortingDraftId,

          payment_document_sorting_draft_id:
            specialistSaved.paymentDocumentSortingDraftId,

          specialistAnalysisId:
            specialistSaved.specialistAnalysisId,

          specialist_analysis_id:
            specialistSaved.specialistAnalysisId,

          latestSpecialistAnalysisId:
            specialistSaved.specialistAnalysisId
        });

      sendJson(res, 200, {
        ok: true,
        message:
          "専門解析結果と契約・保険・リース専門下書きを保存しました。",

        paymentDocumentOcrImportId:
          specialistSaved.paymentDocumentOcrImportId,

        paymentDocumentSortingDraftId:
          specialistSaved.paymentDocumentSortingDraftId,

        specialistAnalysisId:
          specialistSaved.specialistAnalysisId,

        specialist_analysis_id:
          specialistSaved.specialistAnalysisId,

        latestSpecialistAnalysisId:
          specialistSaved.specialistAnalysisId,

        contractInsuranceLeaseDraftId:
          cilSaved.contractInsuranceLeaseDraftId,

        paymentDocumentContractInsuranceLeaseDraftId:
          cilSaved.contractInsuranceLeaseDraftId,

        contract_insurance_lease_draft_id:
          cilSaved.contractInsuranceLeaseDraftId,

        analysisSystemCode:
          specialistSaved.analysisSystemCode,

        analysisSystemLabel:
          specialistSaved.analysisSystemLabel,

        specialistAnalysisStatus:
          specialistSaved.specialistAnalysisStatus,

        specialistAnalysis:
          specialistSaved.saved,

        contractInsuranceLeaseDraft:
          cilSaved
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, {
        ok: false,
        error: err.message || String(err)
      });
    }

    return true;
  }
  /* HD_ORIGIN_GPT2_CIL_COMBINED_SAVE_ROUTE_20260710_END */
  if (req.method === "POST" && String(req.url || "").split("?")[0] === "/api/payment-documents/specialist-analysis-results/save") {
    try {
      const body = await readBody(req);
      const saved = await hdOriginSavePaymentDocumentSpecialistAnalysisResult(body);

      sendJson(res, 200, {
        ok: true,
        message: "専門解析結果を保存しました。",
        paymentDocumentOcrImportId: saved.paymentDocumentOcrImportId,
        paymentDocumentSortingDraftId: saved.paymentDocumentSortingDraftId,
        specialistAnalysisId: saved.specialistAnalysisId,
        specialist_analysis_id: saved.specialistAnalysisId,
        latestSpecialistAnalysisId: saved.specialistAnalysisId,
        analysisSystemCode: saved.analysisSystemCode,
        analysisSystemLabel: saved.analysisSystemLabel,
        specialistAnalysisStatus: saved.specialistAnalysisStatus,
        sortingDraftAutoCreated: !!saved.sortingDraftAutoCreated,
        saved: saved.saved
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, {
        ok: false,
        error: err.message || String(err)
      });
    }

    return true;
  }
  /* HD_ORIGIN_GPT2_SPECIALIST_ANALYSIS_RESULT_SAVE_ROUTE_20260710_END */
  /* HD_ORIGIN_PAYMENT_DOCUMENT_SORTING_DRAFT_SAVE_ROUTE_20260707_START */
  if (req.method === "POST" && String(req.url || "").split("?")[0] === "/api/payment-documents/sorting-drafts/save") {
    try {
      const body = await readBody(req);
      const saved = await hdOriginSavePaymentDocumentSortingDraft(body);

      sendJson(res, 200, {
        ok: true,
        message: "仕分け下書きを保存しました。",
        paymentDocumentSortingDraftId: saved.saved && saved.saved.payment_document_sorting_draft_id,
        paymentDocumentOcrImportId: saved.saved && saved.saved.payment_document_ocr_import_id,
        draftNo: saved.saved && saved.saved.draft_no,
        draftStatus: saved.saved && saved.saved.draft_status,
        latestSortingDraftId: saved.saved && saved.saved.latest_sorting_draft_id,
        sortedAt: saved.saved && saved.saved.sorted_at
      });
    } catch (err) {
      sendJson(res, err.statusCode || 500, {
        ok: false,
        error: err.message || String(err)
      });
    }

    return true;
  }
  /* HD_ORIGIN_PAYMENT_DOCUMENT_SORTING_DRAFT_SAVE_ROUTE_20260707_END */

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
        
        sortResult.draft = sortResult.draft || sortResult.sorting || sortResult.classification || {};
        sortResult.classification = sortResult.draft;
        sortResult.sorting = sortResult.draft;

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
  /* HD_ORIGIN_CONTRACT_INSURANCE_LEASE_DRAFT_SAVE_ROUTE_20260708_START */
  if (req.method === "POST" && urlPath === "/api/payment-documents/contract-insurance-lease-drafts/save") {
    try {
      const body = await readBody(req);
      const saved = await hdOriginSaveContractInsuranceLeaseDraft(body);

      sendJson(res, 200, saved);
    } catch (err) {
      sendJson(res, err.statusCode || 500, {
        ok: false,
        error: err.message || String(err)
      });
    }

    return true;
  }
  /* HD_ORIGIN_CONTRACT_INSURANCE_LEASE_DRAFT_SAVE_ROUTE_20260708_END */
  if (req.method === "POST" && urlPath.startsWith("/api/payment-documents/ai-specialist/")) {
    try {
      const idText = decodeURIComponent(urlPath.replace("/api/payment-documents/ai-specialist/", ""));
      const id = Number(idText);

      if (!Number.isInteger(id) || id < 1) {
        sendJson(res, 400, { ok: false, error: "不正なOCR取込IDです。" });
        return true;
      }

      const body = await readBody(req);

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

      const specialistRouteCode = String(
        body.specialist_route_code ||
        body.specialistRouteCode ||
        body.group ||
        ""
      ).trim();

      const specialistRouteDefinitions = {
        invoice_payable: {
          routeLabel: "請求・未払系解析",
          analysisSystemCode: "invoice_payable_analysis",
          analysisSystemLabel: "請求・未払系専門解析システム"
        },
        tax_public: {
          routeLabel: "税金・公的支払解析",
          analysisSystemCode: "tax_public_analysis",
          analysisSystemLabel: "税金・公的支払専門解析システム"
        },
        utility_communication: {
          routeLabel: "公共料金・通信費解析",
          analysisSystemCode: "utility_communication_analysis",
          analysisSystemLabel: "公共料金・通信費専門解析システム"
        },
        contract_insurance_lease: {
          routeLabel: "契約・保険・リース解析",
          analysisSystemCode: "contract_insurance_lease_analysis",
          analysisSystemLabel: "契約・保険・リース専門解析システム"
        }
      };

      const specialistRouteDefinition =
        specialistRouteDefinitions[specialistRouteCode];

      if (!specialistRouteDefinition) {
        sendJson(res, 400, {
          ok: false,
          error: "専門解析コードが未指定または不正です。",
          received_specialist_route_code:
            specialistRouteCode
        });

        return true;
      }

      const aiResult =
        await createPaymentDocumentSpecialistDraftFromOcrText(
          ocrText,
          {
            ...body,
            specialist_route_code:
              specialistRouteCode,
            specialist_route_label:
              body.specialist_route_label ||
              body.specialistRouteLabel ||
              specialistRouteDefinition.routeLabel,
            analysis_system_code:
              body.analysis_system_code ||
              body.analysisSystemCode ||
              specialistRouteDefinition.analysisSystemCode,
            analysis_system_label:
              body.analysis_system_label ||
              body.analysisSystemLabel ||
              specialistRouteDefinition.analysisSystemLabel,
            group:
              specialistRouteCode,
            draft:
              body.draft ||
              body.classification ||
              {}
          }
        );

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
        prompt_rule_files: aiResult.prompt_rule_files,
        classification: aiResult.classification,
        specialist: aiResult.specialist,
        draft: aiResult.draft
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

  /* HD_ORIGIN_ACCESS_OCR_LOCAL_PATH_ROUTE_20260717_START */
  if (
    req.method === "POST" &&
    urlPath === "/api/payment-documents/access-ocr/local-file"
  ) {
    if (!isLocalAccessOcrRequest(req)) {
      sendJson(res, 403, {
        ok: false,
        error: "このOCR APIはlocalhostからのみ利用できます。"
      });
      return true;
    }

    try {
      const body = await readBody(req);
      const result = await importAccessLocalFileAndRunOcr(body);

      sendJson(
        res,
        result.ok ? 200 : 422,
        result
      );
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: err.message || String(err)
      });
    }

    return true;
  }
  /* HD_ORIGIN_ACCESS_OCR_LOCAL_PATH_ROUTE_20260717_END */
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

/*
HD_ORIGIN_BUSINESS_FLOW_EXECUTION_AI_POLICY_20260711

業務フローAIの最上位目標:
- 人間の転記、選択、照合、再入力、同一確認を徹底的になくす。
- 業務フローAIは案内AIではなく、業務を最後まで流す実行設計AIとする。
- 情報不足を見つけた場合、直ちに人間確認へ回さない。
- 会社マスタ、取引先マスタ、過去処理、原本画像、OCR、専門解析結果、
  銀行明細、契約、支払履歴、現在選択会社などから自動補完を試みる。
- 通常案件はAIとシステムが処理を完了する。
- 人間へ返すのは、自動補完・自動照合・再解析でも解消不能な例外だけ。
- 例外時も「確認してください」だけで終わらせず、
  解消不能な項目、試行済みの自動処理、停止理由、必要な最小入力を提示する。

会社・支払業務:
- 会社は支払書類取込時のcompany_idを正とする。
- 未払画面で会社を選び直させない。
- 支払元銀行口座は同一company_idだけを対象にする。
- 支払実績と銀行出金は同一DBトランザクションで作成する。
- 未払消込額は銀行振込額と源泉徴収額の合計。
- 銀行出金額は銀行振込額と振込手数料の合計。
- 源泉徴収額は値引きではなく源泉預り金として記録する。
- 支払取消時は銀行明細と源泉預り金も連動して取消する。
- 源泉預り金は後日の源泉所得税納付へ引き継ぐ。

業務ルール管理:
- 現在ルールは追記蓄積ではなく、矛盾のない現在版へ修正する。
- 変更履歴は別ファイルへ残す。
*/

/*
HD_ORIGIN_HUMAN_ERROR_ELIMINATION_POLICY_20260711

目的:
可能な限り完全機械化し、人間が作業へ介在して発生するミスをなくす。

機械の誤りへの対策:
機械同士の照合、再解析、再計算、整合性検査、安全停止で制御する。

禁止:
機械の誤り対策として、人間確認を通常業務へ戻すこと。
*/

