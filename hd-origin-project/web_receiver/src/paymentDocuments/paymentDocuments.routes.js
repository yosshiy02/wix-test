const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");
const { sendJson } = require("../response");
const db = require("../db");
const { loadPaymentDocumentPromptText, loadPaymentDocumentPromptTextFromDb, appendPaymentDocumentExternalPrompt, selectPaymentDocumentPromptFiles } = require("./paymentDocuments.aiPromptLoader");
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
/* PAYMENT_DOCUMENT_HTML_UPLOAD_DB_DUPLICATE_20260720_START */
async function findDuplicatePaymentDocument(fileHash, sizeBytes) {
  const targetHash = String(fileHash || "").trim().toLowerCase();
  const targetSize = Number(sizeBytes || 0);

  if (!targetHash) {
    return null;
  }

  const inboxDuplicate = findDuplicateInboxItem(
    targetHash,
    targetSize
  );

  if (inboxDuplicate) {
    return {
      ...inboxDuplicate,
      duplicateSource: "scan-inbox"
    };
  }

  const result = await db.query(`
    SELECT
      payment_document_ocr_import_id,
      original_file_name,
      saved_file_name,
      mime_type,
      size_bytes,
      sha256,
      process_status,
      save_status,
      saved_relative_path,
      saved_at
    FROM accounting.payment_document_ocr_imports
    WHERE deleted_at IS NULL
      AND LOWER(COALESCE(sha256, '')) = $1
      AND (
        $2::bigint <= 0
        OR size_bytes IS NULL
        OR size_bytes = $2::bigint
      )
    ORDER BY
      payment_document_ocr_import_id DESC
    LIMIT 1
  `, [
    targetHash,
    targetSize
  ]);

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    duplicateSource: "database",
    paymentDocumentOcrImportId:
      row.payment_document_ocr_import_id,
    fileName:
      row.saved_file_name ||
      row.original_file_name,
    originalFileName:
      row.original_file_name ||
      row.saved_file_name,
    savedFileName:
      row.saved_file_name ||
      row.original_file_name,
    mimeType:
      row.mime_type ||
      "",
    sizeBytes:
      row.size_bytes,
    sha256:
      row.sha256,
    processStatus:
      row.process_status ||
      "saved",
    saveStatus:
      row.save_status ||
      "saved",
    savedRelativePath:
      row.saved_relative_path ||
      "",
    savedAt:
      row.saved_at ||
      ""
  };
}
/* PAYMENT_DOCUMENT_HTML_UPLOAD_DB_DUPLICATE_20260720_END */

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
      /* PAYMENT_DOCUMENT_PROCESS_STATUS_FILTER_20260725_START */
      const processStatus = String(
        item.processStatus ||
        item.saveStatus ||
        item.savedStatus ||
        ""
      ).toLowerCase();

      return processStatus !== "saved";
      /* PAYMENT_DOCUMENT_PROCESS_STATUS_FILTER_20260725_END */
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
      storageTarget: "postgresql"
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
      storageTarget: "postgresql"
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
      storageTarget: "postgresql"
    };

    writeJson(metaPath, next);

    return {
      ok: false,
      fileName,
      status: "ocr_error",
      error: err.message || String(err),
      dbSaved: false,
      paymentDocumentOcrImportId: null,
      storageTarget: "postgresql"
    };
  }
}

/* PAYMENT_DOCUMENT_RAW_RECEIPT_MOVE_TO_DONE_20260720_START */
function paymentDocumentRawReceiptDirectoryPairs() {
  const pairs = [];
  const seen = new Set();

  function addPair(sourceDir, destinationDir) {
    if (!sourceDir || !destinationDir) {
      return;
    }

    const source = path.resolve(sourceDir);
    const destination = path.resolve(destinationDir);
    const key =
      source.toLowerCase() +
      "|" +
      destination.toLowerCase();

    if (seen.has(key)) {
      return;
    }

    seen.add(key);

    pairs.push({
      sourceDir: source,
      destinationDir: destination
    });
  }

  const configuredRoots = [
    process.env.DROPBOX_ROOT,
    process.env.HD_ORIGIN_DROPBOX_ROOT
  ].filter(Boolean);

  for (const rootValue of configuredRoots) {
    const root = path.resolve(String(rootValue));

    addPair(
      path.join(root, "会社", "レシート", "未OCR"),
      path.join(root, "会社", "レシート", "済OCR")
    );

    addPair(
      path.join(
        root,
        "Dropbox",
        "会社",
        "レシート",
        "未OCR"
      ),
      path.join(
        root,
        "Dropbox",
        "会社",
        "レシート",
        "済OCR"
      )
    );
  }

  for (
    let code = "C".charCodeAt(0);
    code <= "Z".charCodeAt(0);
    code++
  ) {
    const drive = String.fromCharCode(code) + ":\\";

    addPair(
      path.join(
        drive,
        "DROPBOX",
        "Dropbox",
        "会社",
        "レシート",
        "未OCR"
      ),
      path.join(
        drive,
        "DROPBOX",
        "Dropbox",
        "会社",
        "レシート",
        "済OCR"
      )
    );

    addPair(
      path.join(
        drive,
        "Dropbox",
        "会社",
        "レシート",
        "未OCR"
      ),
      path.join(
        drive,
        "Dropbox",
        "会社",
        "レシート",
        "済OCR"
      )
    );
  }

  return pairs;
}

function safeRawReceiptRelativePath(value) {
  const parts = String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .map(part => part.trim())
    .filter(Boolean);

  if (
    parts.length > 0 &&
    parts[0].toLowerCase() === "未ocr"
  ) {
    parts.shift();
  }

  if (
    parts.length < 1 ||
    parts.includes("..") ||
    parts.some(part => part.includes("\0"))
  ) {
    return "";
  }

  return parts.join(path.sep);
}

function resolveRawReceiptSource(meta) {
  const relativePath = safeRawReceiptRelativePath(
    meta.rawSourceRelativePath
  );

  const originalFileName = path.basename(
    String(
      meta.rawSourceOriginalFileName ||
      meta.originalFileName ||
      ""
    )
  );

  for (const pair of paymentDocumentRawReceiptDirectoryPairs()) {
    if (!fs.existsSync(pair.sourceDir)) {
      continue;
    }

    const candidates = [];

    if (relativePath) {
      candidates.push(
        path.resolve(
          pair.sourceDir,
          relativePath
        )
      );
    }

    if (originalFileName) {
      candidates.push(
        path.resolve(
          pair.sourceDir,
          originalFileName
        )
      );
    }

    for (const candidate of candidates) {
      const sourceRoot = path.resolve(pair.sourceDir);

      if (
        candidate !== sourceRoot &&
        !candidate.startsWith(sourceRoot + path.sep)
      ) {
        continue;
      }

      if (
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      ) {
        return {
          sourcePath: candidate,
          sourceDir: pair.sourceDir,
          destinationDir: pair.destinationDir
        };
      }
    }
  }

  return null;
}

function resolveRawReceiptDoneSource(meta) {
  const recordedPath = String(
    meta.rawSourceDonePath || ""
  ).trim();

  if (
    recordedPath &&
    fs.existsSync(recordedPath) &&
    fs.statSync(recordedPath).isFile()
  ) {
    for (const pair of paymentDocumentRawReceiptDirectoryPairs()) {
      const doneRoot = path.resolve(pair.destinationDir);
      const candidate = path.resolve(recordedPath);

      if (
        candidate !== doneRoot &&
        candidate.startsWith(doneRoot + path.sep)
      ) {
        return {
          sourcePath: candidate,
          sourceDir: pair.destinationDir,
          destinationDir: pair.sourceDir
        };
      }
    }
  }

  const relativePath = safeRawReceiptRelativePath(
    meta.rawSourceRelativePath
  );

  const originalFileName = path.basename(
    String(
      meta.rawSourceOriginalFileName ||
      meta.originalFileName ||
      ""
    )
  );

  for (const pair of paymentDocumentRawReceiptDirectoryPairs()) {
    if (!fs.existsSync(pair.destinationDir)) {
      continue;
    }

    const candidates = [];

    if (relativePath) {
      candidates.push(
        path.resolve(pair.destinationDir, relativePath)
      );
    }

    if (originalFileName) {
      candidates.push(
        path.resolve(pair.destinationDir, originalFileName)
      );
    }

    for (const candidate of candidates) {
      const doneRoot = path.resolve(pair.destinationDir);

      if (
        candidate !== doneRoot &&
        candidate.startsWith(doneRoot + path.sep) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      ) {
        return {
          sourcePath: candidate,
          sourceDir: pair.destinationDir,
          destinationDir: pair.sourceDir
        };
      }
    }
  }

  return null;
}

function moveRawReceiptBackToPending(meta) {
  const resolved = resolveRawReceiptDoneSource(meta);

  if (!resolved) {
    return {
      status: "not_found",
      moved: false,
      sourcePath: "",
      destinationPath: "",
      error: "済OCRに該当原本が見つかりません。"
    };
  }

  ensureDir(resolved.destinationDir);

  const destinationPath = path.join(
    resolved.destinationDir,
    path.basename(resolved.sourcePath)
  );

  if (fs.existsSync(destinationPath)) {
    return {
      status: "destination_exists",
      moved: false,
      sourcePath: resolved.sourcePath,
      destinationPath,
      error: "未OCRに同名ファイルが既にあります。"
    };
  }

  try {
    moveFileAllowCrossDevice(
      resolved.sourcePath,
      destinationPath
    );

    return {
      status: "moved",
      moved: true,
      sourcePath: resolved.sourcePath,
      destinationPath,
      error: ""
    };
  } catch (err) {
    return {
      status: "move_error",
      moved: false,
      sourcePath: resolved.sourcePath,
      destinationPath,
      error: err.message || String(err)
    };
  }
}
function moveRawReceiptToOcrDone(meta) {
  const resolved = resolveRawReceiptSource(meta);

  if (!resolved) {
    return {
      status: "not_found",
      moved: false,
      sourcePath: "",
      destinationPath: "",
      error: ""
    };
  }

  ensureDir(resolved.destinationDir);

  const destinationPath = uniqueFilePath(
    resolved.destinationDir,
    path.basename(resolved.sourcePath)
  );

  try {
    moveFileAllowCrossDevice(
      resolved.sourcePath,
      destinationPath
    );

    return {
      status: "moved",
      moved: true,
      sourcePath: resolved.sourcePath,
      destinationPath,
      error: ""
    };
  } catch (err) {
    return {
      status: "move_error",
      moved: false,
      sourcePath: resolved.sourcePath,
      destinationPath,
      error: err.message || String(err)
    };
  }
}
/* PAYMENT_DOCUMENT_RAW_RECEIPT_MOVE_TO_DONE_20260720_END */

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
  const ocrText = String(
    current.ocrRawText ||
    current.ocr_raw_text ||
    current.ocrText ||
    ""
  ).trim();

  if (!ocrText) {
    return {
      ok: false,
      fileName,
      status: "no_ocr",
      originalFileName:
        current.originalFileName ||
        path.basename(filePath),
      error:
        "OCR本文が未保存のため、保存できません。"
    };
  }

  const now = new Date().toISOString();

  const next = {
    ...current,
    originalFileName:
      current.originalFileName ||
      path.basename(filePath),
    savedFileName:
      current.savedFileName ||
      path.basename(filePath),
    mimeType:
      current.mimeType ||
      getMimeType(filePath),
    sizeBytes:
      current.sizeBytes ||
      stat.size,

    ocrStatus:
      current.ocrStatus ||
      "ocr_done",
    ocrRawText: ocrText,
    ocr_raw_text: ocrText,
    ocrText,
    ocrTextLength: ocrText.length,

    processStatus: "saved",
    savedAt: now,
    savedByPage: "payment-document-inbox",
    updatedAt: now
  };

  let moved = null;

  try {
    moved = movePaymentDocumentToSaved(
      filePath,
      next
    );

    const movedFilePath =
      safePaymentDocumentFilePathFromRelative(
        moved.savedRelativePath
      );

    const movedMetaPath =
      safePaymentDocumentFilePathFromRelative(
        moved.savedMetaRelativePath
      );

    const savedMeta =
      (
        movedMetaPath &&
        fs.existsSync(movedMetaPath)
      )
        ? (
            readJsonSafe(movedMetaPath) ||
            {}
          )
        : {};

    const dbMeta = {
      ...next,
      ...savedMeta,
      originalFileName:
        moved.originalFileName ||
        next.originalFileName,
      savedFileName:
        moved.fileName ||
        next.savedFileName,
      savedRelativePath:
        moved.savedRelativePath,
      savedMetaRelativePath:
        moved.savedMetaRelativePath,
      savedAt:
        moved.savedAt ||
        now,
      processStatus: "saved",
      ocrRawText: ocrText,
      ocr_raw_text: ocrText,
      ocrText,
      ocrTextLength: ocrText.length
    };

    const dbRow =
      await upsertPaymentDocumentOcrImportWithTransaction(
        dbMeta,
        moved.fileName
      );

    if (
      !dbRow ||
      !dbRow.payment_document_ocr_import_id
    ) {
      throw new Error(
        "OCR取込DBレコードを作成できませんでした。"
      );
    }

    const reviewStatusResult = await db.query(`
      WITH ocr_phase AS (
        SELECT MAX(display_order) AS last_ocr_order
        FROM accounting.payment_document_current_statuses
        WHERE is_active = TRUE
          AND (
            current_status LIKE 'OCR%'
            OR COALESCE(description, '') LIKE '%OCR%'
          )
      )
      SELECT current_status
      FROM accounting.payment_document_current_statuses
      CROSS JOIN ocr_phase
      WHERE is_active = TRUE
        AND is_processing = FALSE
        AND is_terminal = FALSE
        AND is_error = FALSE
        AND display_order > ocr_phase.last_ocr_order
      ORDER BY display_order
      LIMIT 1
    `);

    const reviewCurrentStatus =
      reviewStatusResult.rows[0]?.current_status;

    if (!reviewCurrentStatus) {
      throw new Error(
        "ステータスマスタからOCR後の表示先を解決できませんでした。"
      );
    }

    const statusUpdateResult = await db.query(`
      UPDATE accounting.payment_document_ocr_imports
      SET
        current_status = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE payment_document_ocr_import_id = $1
        AND deleted_at IS NULL
      RETURNING current_status
    `, [
      dbRow.payment_document_ocr_import_id,
      reviewCurrentStatus
    ]);

    if (statusUpdateResult.rowCount !== 1) {
      throw new Error(
        "OCR取込レコードのcurrent_statusを更新できませんでした。"
      );
    }

    const finalMeta = {
      ...dbMeta,
      currentStatus: reviewCurrentStatus,
      current_status: reviewCurrentStatus,
      dbSaved: true,
      paymentDocumentOcrImportId:
        dbRow.payment_document_ocr_import_id,
      databaseSavedAt:
        new Date().toISOString()
    };

    if (movedMetaPath) {
      writeJson(
        movedMetaPath,
        finalMeta
      );
    }

    const rawSourceMove =
      moveRawReceiptToOcrDone(finalMeta);

    finalMeta.rawSourceMoveStatus =
      rawSourceMove.status;
    finalMeta.rawSourceMoved =
      rawSourceMove.moved;
    finalMeta.rawSourcePath =
      rawSourceMove.sourcePath;
    finalMeta.rawSourceDonePath =
      rawSourceMove.destinationPath;
    finalMeta.rawSourceMoveError =
      rawSourceMove.error;
    finalMeta.rawSourceMovedAt =
      rawSourceMove.moved
        ? new Date().toISOString()
        : "";

    if (movedMetaPath) {
      writeJson(
        movedMetaPath,
        finalMeta
      );
    }

    return {
      ok: true,
      fileName: moved.fileName,
      originalInboxFileName: fileName,
      originalFileName:
        moved.originalFileName,
      status: "saved",
      rawSourceMoveStatus: rawSourceMove.status,
      rawSourceMoved: rawSourceMove.moved,
      rawSourcePath: rawSourceMove.sourcePath,
      rawSourceDonePath: rawSourceMove.destinationPath,
      rawSourceMoveError: rawSourceMove.error,
      savedAt:
        moved.savedAt ||
        now,
      textLength:
        ocrText.length,
      savedRelativePath:
        moved.savedRelativePath,
      savedMetaRelativePath:
        moved.savedMetaRelativePath,
      dbSaved: true,
      paymentDocumentOcrImportId:
        dbRow.payment_document_ocr_import_id
    };
  } catch (err) {
    if (moved) {
      const movedFilePath =
        safePaymentDocumentFilePathFromRelative(
          moved.savedRelativePath
        );

      const movedMetaPath =
        safePaymentDocumentFilePathFromRelative(
          moved.savedMetaRelativePath
        );

      try {
        if (
          movedFilePath &&
          fs.existsSync(movedFilePath)
        ) {
          moveFileAllowCrossDevice(
            movedFilePath,
            filePath
          );
        }

        if (
          movedMetaPath &&
          fs.existsSync(movedMetaPath)
        ) {
          moveFileAllowCrossDevice(
            movedMetaPath,
            metaPath
          );
        }

        const restoredMeta =
          readJsonSafe(metaPath) ||
          next;

        writeJson(
          metaPath,
          {
            ...restoredMeta,
            processStatus:
              current.processStatus ||
              "ocr_done",
            saveStatus:
              current.saveStatus ||
              "",
            savedStatus:
              current.savedStatus ||
              "",
            evidenceSaved:
              !!current.evidenceSaved,
            ocrSaved:
              !!current.ocrSaved,
            dbSaved: false,
            paymentDocumentOcrImportId:
              current.paymentDocumentOcrImportId ||
              null,
            saveError:
              err.message ||
              String(err),
            saveErrorAt:
              new Date().toISOString()
          }
        );
      } catch (rollbackError) {
        const combined = new Error(
          "DB保存失敗後のINBOX復元にも失敗しました。" +
          " DB_ERROR=" +
          (
            err.message ||
            String(err)
          ) +
          " ROLLBACK_ERROR=" +
          (
            rollbackError.message ||
            String(rollbackError)
          )
        );

        combined.originalError = err;
        combined.rollbackError = rollbackError;

        throw combined;
      }
    }

    throw err;
  }
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
      o.current_status,
      o.latest_specialist_analysis_id,
      o.sorted_at,
      o.created_at,
      o.updated_at,

      s.specialist_analysis_id,
      s.analysis_system_code,
      s.analysis_system_label,
      s.ai_confidence,
      s.ai_reason,
      CASE
        WHEN LOWER(
          COALESCE(
            s.raw_result_json->>'needs_review',
            'false'
          )
        ) = 'true'
          THEN TRUE
        ELSE FALSE
      END AS needs_review,
      s.warnings_json,
      s.raw_result_json,
      COALESCE(
        s.raw_result_json->'analysis',
        '{}'::jsonb
      ) AS analysis_json,
      COALESCE(
        s.raw_result_json->'visible_fields',
        s.raw_result_json->'visibleFields',
        '{}'::jsonb
      ) AS visible_fields_json,
      COALESCE(
        s.raw_result_json->'visible_field_labels',
        s.raw_result_json->'visibleFieldLabels',
        '{}'::jsonb
      ) AS visible_field_labels_json,
      s.created_at AS specialist_created_at,
      s.updated_at AS specialist_updated_at,

      b.basic_analysis_id,
      b.company_id AS basic_company_id,
      b.ai_confidence AS basic_ai_confidence,
      b.ai_reason AS basic_ai_reason,
      b.needs_review AS basic_needs_review,
      b.warnings_json AS basic_warnings_json,
      b.raw_result_json AS basic_raw_result_json,
      b.analysis_completed AS basic_analysis_completed,
      b.completed_at AS basic_completed_at,
      b.created_at AS basic_created_at,
      b.updated_at AS basic_updated_at

    FROM accounting.payment_document_ocr_imports o

    LEFT JOIN accounting.payment_document_specialist_analysis_results s
      ON s.specialist_analysis_id = o.latest_specialist_analysis_id
     AND s.is_current = TRUE

    LEFT JOIN accounting.payment_document_basic_analysis_results b
      ON b.payment_document_ocr_import_id =
         o.payment_document_ocr_import_id
     AND b.is_current = TRUE

    WHERE o.deleted_at IS NULL
      AND COALESCE(o.ocr_raw_text, '') <> ''
      AND (
        o.current_status = (
          WITH ocr_phase AS (
            SELECT MAX(display_order) AS last_ocr_order
            FROM accounting.payment_document_current_statuses
            WHERE is_active = TRUE
              AND (
                current_status LIKE 'OCR%'
                OR COALESCE(description, '') LIKE '%OCR%'
              )
          )
          SELECT current_status
          FROM accounting.payment_document_current_statuses
          CROSS JOIN ocr_phase
          WHERE is_active = TRUE
            AND is_processing = FALSE
            AND is_terminal = FALSE
            AND is_error = FALSE
            AND display_order > ocr_phase.last_ocr_order
          ORDER BY display_order
          LIMIT 1
        )
      )

    ORDER BY
      o.sorted_at DESC NULLS LAST,
      o.saved_at DESC NULLS LAST,
      o.ocr_at DESC NULLS LAST,
      o.payment_document_ocr_import_id DESC

    LIMIT 500
  `);

  return result.rows.map(row => {
    const latestSpecialistAnalysis = row.specialist_analysis_id
      ? {
          specialistAnalysisId: row.specialist_analysis_id,
          paymentDocumentOcrImportId:
            row.payment_document_ocr_import_id,
          analysisSystemCode: row.analysis_system_code,
          analysisSystemLabel: row.analysis_system_label,
          aiConfidence: row.ai_confidence,
          aiReason: row.ai_reason,
          needsReview: !!row.needs_review,
          warnings: row.warnings_json || [],
          rawResult: row.raw_result_json || {},
          analysis: row.analysis_json || {},
          visibleFields: row.visible_fields_json || {},
          visibleFieldLabels:
            row.visible_field_labels_json || {},
          createdAt: row.specialist_created_at,
          updatedAt: row.specialist_updated_at
        }
      : null;

    const basicRawResult =
      row.basic_raw_result_json &&
      typeof row.basic_raw_result_json === "object"
        ? row.basic_raw_result_json
        : {};

    const basicAnalysis =
      basicRawResult.analysis &&
      typeof basicRawResult.analysis === "object"
        ? basicRawResult.analysis
        : {};

    const latestBasicAnalysis = row.basic_analysis_id
      ? {
          basicAnalysisId: row.basic_analysis_id,
          basic_analysis_id: row.basic_analysis_id,
          paymentDocumentOcrImportId:
            row.payment_document_ocr_import_id,
          payment_document_ocr_import_id:
            row.payment_document_ocr_import_id,
          companyId: row.basic_company_id,
          company_id: row.basic_company_id,
          aiConfidence:
            row.basic_ai_confidence,
          ai_confidence:
            row.basic_ai_confidence,
          aiReason:
            row.basic_ai_reason,
          ai_reason:
            row.basic_ai_reason,
          needsReview:
            row.basic_needs_review,
          needs_review:
            row.basic_needs_review,
          warnings:
            row.basic_warnings_json || [],
          warnings_json:
            row.basic_warnings_json || [],
          rawResult:
            basicRawResult,
          raw_result:
            basicRawResult,
          sortResult:
            basicAnalysis.sortResult ||
            basicAnalysis.sort_result ||
            basicAnalysis.classification ||
            basicAnalysis,
          sort_result:
            basicAnalysis.sort_result ||
            basicAnalysis.sortResult ||
            basicAnalysis.classification ||
            basicAnalysis,
          visibleFields:
            basicAnalysis.visibleFields ||
            basicAnalysis.visible_fields ||
            {},
          visible_fields:
            basicAnalysis.visible_fields ||
            basicAnalysis.visibleFields ||
            {},
          aiSummary:
            basicAnalysis.aiSummary ||
            basicAnalysis.ai_summary ||
            {},
          ai_summary:
            basicAnalysis.ai_summary ||
            basicAnalysis.aiSummary ||
            {},
          analysisCompleted:
            row.basic_analysis_completed,
          analysis_completed:
            row.basic_analysis_completed,
          completedAt:
            row.basic_completed_at,
          completed_at:
            row.basic_completed_at,
          createdAt:
            row.basic_created_at,
          created_at:
            row.basic_created_at,
          updatedAt:
            row.basic_updated_at,
          updated_at:
            row.basic_updated_at
        }
      : null;

    return {
      source: "database",
      paymentDocumentOcrImportId:
        row.payment_document_ocr_import_id,
      imageUrl:
        "/api/payment-documents/ocr-imports/file/" +
        encodeURIComponent(
          String(row.payment_document_ocr_import_id)
        ),
      fileName:
        row.saved_file_name || row.original_file_name,
      originalFileName:
        row.original_file_name || row.saved_file_name,
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
      ocrTextPreview:
        String(row.ocr_raw_text || "").slice(0, 240),
      ocrTextLength: row.ocr_text_length,
      processStatus: row.process_status,
      saveStatus: row.save_status,
      savedStatus: row.save_status,
      evidenceSaved: row.evidence_saved,
      ocrSaved: row.ocr_saved,
      savedRelativePath: row.saved_relative_path,
      savedMetaRelativePath:
        row.saved_meta_relative_path,
      savedAt: row.saved_at,
      savedByPage: row.saved_by_page,
      currentStatus: row.current_status,
      latestBasicAnalysisId:
        row.basic_analysis_id,
      latestBasicAnalysis,
      latestSpecialistAnalysisId:
        row.latest_specialist_analysis_id,
      sortedAt: row.sorted_at,
      latestSpecialistAnalysis,
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
function normalizeBasicAnalysisCandidate(value) {
  const analysis = value && typeof value === "object" ? value : {};

  return {
    document_type_code: String(analysis.document_type_code || "").trim(),
    payment_destination_code: String(analysis.payment_destination_code || "").trim(),
    accounting_category_code: String(analysis.accounting_category_code || "").trim(),
    payable_kind_code: String(analysis.payable_kind_code || "").trim(),
    source_type_code: String(analysis.source_type_code || "").trim(),

    // --- ここから追加: AIが返した重要なシステム情報を消失させずに維持する ---
    analysis_system_code: String(analysis.analysis_system_code || "").trim(),
    analysis_system_label: String(analysis.analysis_system_label || "").trim(),
    analysis_system_reason: String(analysis.analysis_system_reason || "").trim(),
    analysis_system_confidence: String(analysis.analysis_system_confidence || "").trim(),
    specialist_route_code: String(analysis.specialist_route_code || "").trim(),
    specialist_route_label: String(analysis.specialist_route_label || "").trim(),
    
    ai_summary: analysis.ai_summary && typeof analysis.ai_summary === "object" ? analysis.ai_summary : {},
    fields: analysis.fields && typeof analysis.fields === "object" ? analysis.fields : {},
    visible_field_labels: Array.isArray(analysis.visible_field_labels) ? analysis.visible_field_labels : [],
    document_group: String(analysis.document_group || "").trim(),
    // --- 追加ここまで ---

    vendor_name: String(analysis.vendor_name || "").trim(),
    issue_date: String(analysis.issue_date || "").trim(),
    due_date: String(analysis.due_date || "").trim(),
    invoice_number: String(analysis.invoice_number || "").trim(),

    total_amount: analysis.total_amount === null || analysis.total_amount === undefined || analysis.total_amount === ""
      ? null
      : Number(analysis.total_amount),

    tax_amount: analysis.tax_amount === null || analysis.tax_amount === undefined || analysis.tax_amount === ""
      ? null
      : Number(analysis.tax_amount),

    currency: String(analysis.currency || "JPY").trim(),
    summary: String(analysis.summary || "").trim(),
    memo: String(analysis.memo || "").trim(),

    confidence: {
      document_type: Number(analysis.confidence && analysis.confidence.document_type || 0),
      payment_destination: Number(analysis.confidence && analysis.confidence.payment_destination || 0),
      vendor_name: Number(analysis.confidence && analysis.confidence.vendor_name || 0),
      total_amount: Number(analysis.confidence && analysis.confidence.total_amount || 0)
    },

    warnings: Array.isArray(analysis.warnings)
      ? analysis.warnings.map(item => String(item || "").trim()).filter(Boolean)
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

  const base = draft && typeof draft === "object" ? { ...analysis } : {};
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
  const base = draft && typeof draft === "object" ? { ...analysis } : {};

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
    "scan_upload, pdf_upload, mail_saved, web_download",
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

async function createBasicAnalysisFromOcrText(ocrText) {
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
          content: await appendPaymentDocumentExternalPrompt(appendPaymentDocumentMasterCodeInstruction(prompt), ["business-rules.txt", "legacy.extra-rules.txt"])
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

  const normalized = normalizeBasicAnalysisCandidate(parsed);
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
/* 重複した古い normalizeBasicAnalysisCandidate を削除しました */



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

  const base = draft && typeof draft === "object" ? { ...analysis } : {};
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
  const base = draft && typeof draft === "object" ? { ...analysis } : {};

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
    "source_type_code: scan_upload, pdf_upload, mail_saved, web_download",
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
  const out = draft && typeof draft === "object" ? { ...analysis } : {};
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

  paymentDocumentInvoiceTitleSetField(fields, "document_title", "analysisDocumentTitle", "請求書");
  paymentDocumentInvoiceTitleSetField(fields, "issuer", "analysisIssuer", issuer);
  paymentDocumentInvoiceTitleSetField(fields, "vendor_name", "analysisVendorName", issuer);
  paymentDocumentInvoiceTitleSetField(fields, "recipient", "analysisRecipient", recipient);
  paymentDocumentInvoiceTitleSetField(fields, "company_name", "analysisCompanyName", recipient.replace(/\s*御中\s*$/, ""));
  paymentDocumentInvoiceTitleSetField(fields, "invoice_no", "analysisInvoiceNo", invoiceNo);
  paymentDocumentInvoiceTitleSetField(fields, "registration_no", "analysisRegistrationNo", registrationNo);
  paymentDocumentInvoiceTitleSetField(fields, "document_date", "analysisDocumentDate", billingDate);
  paymentDocumentInvoiceTitleSetField(fields, "issue_date", "analysisIssueDate", billingDate);
  paymentDocumentInvoiceTitleSetField(fields, "billing_date", "analysisBillingDate", billingDate);
  paymentDocumentInvoiceTitleSetField(fields, "due_date", "analysisDueDate", dueDate);
  paymentDocumentInvoiceTitleSetField(fields, "amount", "analysisAmount", totalAmount);
  paymentDocumentInvoiceTitleSetField(fields, "total_amount", "analysisTotalAmount", totalAmount);
  paymentDocumentInvoiceTitleSetField(fields, "amount_in_tax", "analysisAmountInTax", totalAmount);
  paymentDocumentInvoiceTitleSetField(fields, "tax_excluded_amount", "analysisTaxExcludedAmount", taxExcluded);
  paymentDocumentInvoiceTitleSetField(fields, "amount_without_tax", "analysisAmountWithoutTax", taxExcluded);
  paymentDocumentInvoiceTitleSetField(fields, "tax_amount", "analysisTaxAmount", taxAmount);
  paymentDocumentInvoiceTitleSetField(fields, "summary", "analysisSummaryField", itemName || "請求書");
  paymentDocumentInvoiceTitleSetField(fields, "payable_registration_flag", "analysisPayableRegistrationFlag", true);
  paymentDocumentInvoiceTitleSetField(fields, "accounts_payable_flag", "analysisAccountsPayableFlag", !!isMaterialPurchase);

  const dummyNote = paymentDocumentInvoiceTitleHasAny(text, ["ダミー証憑", "開発テスト用", "実在の取引ではありません"])
    ? "これは開発テスト用のダミー証憑です。実在の取引ではありません。"
    : "";

  if (dummyNote) {
    const currentMemo = String(fields.memo || fields.analysisMemo || "").trim();
    paymentDocumentInvoiceTitleSetField(
      fields,
      "memo",
      "analysisMemo",
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
  const out = draft && typeof draft === "object" ? { ...analysis } : {};
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

  paymentDocumentInvoiceCleanupSet(fields, "ai_tax_public_flag", "analysisAiTaxPublicFlag", "対象外");
  paymentDocumentInvoiceCleanupSet(fields, "ai_contract_flag", "analysisAiContractFlag", "対象外");
  paymentDocumentInvoiceCleanupSet(fields, "ai_expense_flag", "analysisAiExpenseFlag", isMaterialPurchase ? "対象外" : "経費");
  paymentDocumentInvoiceCleanupSet(fields, "ai_unpaid_flag", "analysisAiUnpaidFlag", "登録する");

  if (issuer) {
    paymentDocumentInvoiceCleanupSet(fields, "issuer", "analysisIssuer", issuer);
    paymentDocumentInvoiceCleanupSet(fields, "vendor_name", "analysisVendorName", issuer);
  }

  if (recipient) {
    paymentDocumentInvoiceCleanupSet(fields, "recipient", "analysisRecipient", recipient);
  }

  if (companyName) {
    paymentDocumentInvoiceCleanupSet(fields, "company_name", "analysisCompanyName", companyName);
    fields.companyName = companyName;
    fields.recipient_company_name = companyName;
  }

  paymentDocumentInvoiceCleanupSet(fields, "payable_registration_flag", "analysisPayableRegistrationFlag", true);
  paymentDocumentInvoiceCleanupSet(fields, "accounts_payable_flag", "analysisAccountsPayableFlag", !!isMaterialPurchase);

  /*
    税金系の残骸を空にする。
    表示対象から外すのが主目的だが、残値も掃除する。
  */
  paymentDocumentInvoiceCleanupSet(fields, "tax_item", "analysisTaxItem", "");
  paymentDocumentInvoiceCleanupSet(fields, "tax_office", "analysisTaxOffice", "");
  paymentDocumentInvoiceCleanupSet(fields, "fiscal_year", "analysisFiscalYear", "");
  paymentDocumentInvoiceCleanupSet(fields, "tax_term", "analysisTaxTerm", "");
  paymentDocumentInvoiceCleanupSet(fields, "payment_no", "analysisPaymentNo", "");
  paymentDocumentInvoiceCleanupSet(fields, "notice_no", "analysisNoticeNo", "");
  paymentDocumentInvoiceCleanupSet(fields, "management_no", "analysisManagementNo", "");
  paymentDocumentInvoiceCleanupSet(fields, "late_fee_amount", "analysisLateFeeAmount", "");
  paymentDocumentInvoiceCleanupSet(fields, "non_tax_amount", "analysisNonTaxAmount", "");

  if (fields.memo || fields.analysisMemo) {
    const memo = paymentDocumentInvoiceCleanupUniqueLines(fields.memo || fields.analysisMemo);
    fields.memo = memo;
    fields.analysisMemo = memo;
  }

  if (fields.warnings || fields.analysisWarnings) {
    const warningText = paymentDocumentInvoiceCleanupUniqueLines(
      String(fields.warnings || fields.analysisWarnings || "")
        .split(/\r?\n/)
        .filter((line) => !String(line || "").includes("納付書ルール補正"))
        .join("\n")
    );

    fields.warnings = warningText;
    fields.analysisWarnings = warningText;
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
  const out = draft && typeof draft === "object" ? analysis : {};

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

  paymentDocumentInvoiceFinalSet(fields, "ai_tax_public_flag", "analysisAiTaxPublicFlag", "対象外");
  paymentDocumentInvoiceFinalSet(fields, "tax_public_flag", "analysisAiTaxPublicFlag", "対象外");

  paymentDocumentInvoiceFinalSet(fields, "ai_contract_flag", "analysisAiContractFlag", "対象外");
  paymentDocumentInvoiceFinalSet(fields, "contract_flag", "analysisAiContractFlag", "対象外");

  paymentDocumentInvoiceFinalSet(fields, "ai_expense_flag", "analysisAiExpenseFlag", isMaterialPurchase ? "対象外" : "経費");
  paymentDocumentInvoiceFinalSet(fields, "expense_flag", "analysisAiExpenseFlag", isMaterialPurchase ? "対象外" : "経費");

  if (issuer) {
    paymentDocumentInvoiceFinalSet(fields, "issuer", "analysisIssuer", issuer);
    paymentDocumentInvoiceFinalSet(fields, "vendor_name", "analysisVendorName", issuer);
  }

  if (recipient) {
    paymentDocumentInvoiceFinalSet(fields, "recipient", "analysisRecipient", recipient);
  }

  if (companyName) {
    paymentDocumentInvoiceFinalSet(fields, "company_name", "analysisCompanyName", companyName);
    fields.companyName = companyName;
    fields.recipient_company_name = companyName;
    out.company_name = companyName;
    out.companyName = companyName;
  }

  paymentDocumentInvoiceFinalSet(fields, "payable_registration_flag", "analysisPayableRegistrationFlag", true);
  paymentDocumentInvoiceFinalSet(fields, "accounts_payable_flag", "analysisAccountsPayableFlag", !!isMaterialPurchase);

  /*
    税金系の空欄項目を残さない。
  */
  const emptyPairs = [
    ["tax_item", "analysisTaxItem"],
    ["tax_office", "analysisTaxOffice"],
    ["fiscal_year", "analysisFiscalYear"],
    ["tax_term", "analysisTaxTerm"],
    ["payment_no", "analysisPaymentNo"],
    ["notice_no", "analysisNoticeNo"],
    ["management_no", "analysisManagementNo"],
    ["late_fee_amount", "analysisLateFeeAmount"],
    ["non_tax_amount", "analysisNonTaxAmount"]
  ];

  for (const pair of emptyPairs) {
    paymentDocumentInvoiceFinalSet(fields, pair[0], pair[1], "");
  }

  if (fields.memo || fields.analysisMemo) {
    const memo = paymentDocumentInvoiceFinalUniqueLines(fields.memo || fields.analysisMemo);
    fields.memo = memo;
    fields.analysisMemo = memo;
  }

  if (fields.warnings || fields.analysisWarnings) {
    const warningText = paymentDocumentInvoiceFinalUniqueLines(
      String(fields.warnings || fields.analysisWarnings || "")
        .split(/\r?\n/)
        .filter((line) => !String(line || "").includes("納付書ルール補正"))
        .join("\n")
    );

    fields.warnings = warningText;
    fields.analysisWarnings = warningText;
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
  const out = draft && typeof draft === "object" ? analysis : {};

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
    paymentDocumentInvoiceDisplaySet(fields, "登録番号", "analysisRegistrationNo", registrationNo);
    fields.registration_no = registrationNo;
    fields.invoice_registration_no = registrationNo;
  }

  if (taxExcluded) {
    paymentDocumentInvoiceDisplaySet(fields, "税抜金額", "analysisAmountExTax", taxExcluded);
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
  fields.analysisWarnings = "";
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
    "証憑区分", "書類名", "発行元", "支払先", "宛名", "会社名", "個人名", "住所", "電話番号",
    "書類日付", "発行日", "支払期限・納期限",
    "請求・支払金額", "合計金額", "税込金額",
    "会計区分", "未払種別", "支払先マスタ候補", "勘定科目", "税区分", "対象者", "目的", "部門", "摘要",
    "会社負担可否", "個人負担混在", "未払登録", "買掛登録", "社内メモ", "要確認メモ"
  ];

  const byGroup = {
    receipt: [
      "領収書番号", "登録番号", "取引日・利用日", "決済日",
      "税抜金額", "消費税額", "10%対象金額", "10%消費税",
      "8%対象金額", "8%消費税", "支払方法", "明細候補"
    ],
    tax: [
      "納付番号", "通知書番号", "管理番号", "税目", "納付先", "年度", "期別",
      "延滞金", "非課税・不課税", "明細候補"
    ],
    invoice: [
      "請求書番号", "登録番号", "法人番号", "請求日", "締日", "支払予定日",
      "税抜金額", "消費税額", "10%対象金額", "10%消費税", "8%対象金額", "8%消費税",
      "支払方法", "支払状態", "振込先銀行", "銀行コード", "支店名", "支店コード",
      "口座種別", "口座番号", "口座名義", "インボイス区分", "明細候補"
    ],
    card: [
      "カード会社", "カード名", "カード番号下4桁", "取引日・利用日", "引落日", "決済日",
      "今回利用額", "前回残高", "入金額", "未払残高", "引落銀行", "明細候補"
    ],
    utility: [
      "お客様番号", "公共料金お客様番号", "使用期間", "使用量", "対象開始日", "対象終了日",
      "引落日", "支払方法", "支払状態", "明細候補"
    ],
    contract: [
      "契約番号", "保険種類", "リース物件", "対象開始日", "対象終了日",
      "契約開始日", "契約終了日", "更新日", "支払回数", "支払方法", "明細候補"
    ],
    reference: [
      "注文番号", "管理番号", "取引番号", "納品日",
      "税抜金額", "消費税額", "明細候補"
    ],
    other: [
      "管理番号", "お客様番号", "取引番号", "注文番号", "明細候補"
    ]
  };

  const extra = byGroup[group] || byGroup.other;
  return Array.from(new Set([...common, ...extra]));
}

function paymentDocumentAiGroupFromAnalysis(draft) {
  const d = draft && typeof draft === "object" ? analysis : {};
  const summary = d.ai_summary && typeof d.ai_summary === "object" ? d.ai_summary : {};
  const fields = d.fields && typeof d.fields === "object" ? d.fields : {};

  const analysisSystemCode = String(
    d.analysis_system_code || ""
  ).trim().toLowerCase();

  if (analysisSystemCode === "invoice_payable") return "invoice";
  if (analysisSystemCode === "receipt_evidence") return "receipt";
  if (analysisSystemCode === "tax_public") return "tax";
  if (
    analysisSystemCode === "card_statement" ||
    analysisSystemCode === "card_payment"
  ) return "card";
  if (analysisSystemCode === "utility_communication") return "utility";
  if (analysisSystemCode === "contract_insurance_lease") return "contract";
  if (
    analysisSystemCode === "delivery_note" ||
    analysisSystemCode === "delivery_note"
  ) return "reference";
  if (analysisSystemCode === "needs_review") return "other";

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

  if (
    text.includes("receipt") ||
    text.includes("領収") ||
    text.includes("レシート")
  ) return "receipt";

  if (
    text.includes("tax_payment_notice") ||
    text.includes("tax_public") ||
    text.includes("tax") ||
    text.includes("税") ||
    text.includes("納税") ||
    text.includes("納付")
  ) return "tax";

  if (
    text.includes("card_statement") ||
    text.includes("card_payable") ||
    text.includes("カード")
  ) return "card";

  if (
    text.includes("utility_notice") ||
    text.includes("public_utility") ||
    text.includes("公共") ||
    text.includes("電気") ||
    text.includes("水道") ||
    text.includes("ガス") ||
    text.includes("通信")
  ) return "utility";

  if (
    text.includes("insurance_notice") ||
    text.includes("insurance") ||
    text.includes("保険") ||
    text.includes("lease_contract") ||
    text.includes("lease") ||
    text.includes("リース") ||
    text.includes("contract") ||
    text.includes("契約")
  ) return "contract";

  if (
    text.includes("delivery_note") ||
    text.includes("納品") ||
    text.includes("注文書") ||
    text.includes("見積書") ||
    text.includes("検収書")
  ) return "reference";

  if (
    text.includes("invoice") ||
    text.includes("payable") ||
    text.includes("請求")
  ) return "invoice";

  return "other";
}

function buildPaymentDocumentClassificationPrompt(
  ocrText,
  context = {}
) {
  const fixedCompanyId = Number(
    context && context.company_id || 0
  );

  const fixedCompanyCode = String(
    context && context.company_code || ""
  ).trim();
  return [
    "あなたは支払書類のStage1共通仕分けAIです。",
    "画像は見ていません。OCR本文全体を根拠に仕分けしてください。",
    "選択区分は、後続で提示されるPostgreSQLの有効マスタ候補だけを使用してください。",
    "",
    "固定会社情報:",
    "- company_id: " + String(fixedCompanyId),
    "- company_code: " + fixedCompanyCode,
    "- この会社情報はプロジェクト入口でユーザーが選択した正式値である。",
    "- company_idとcompany_codeを再判定・変更してはならない。",
    "",
    "絶対ルール:",
    "- 文書種別、処理先、会計区分、専門解析先はAIが判断する。",
    "- company_idは固定入力値と完全に同じ値を返す。",
    "- company_codeは固定入力値と完全に同じ値を返す。",
    "- document_type_codeは文書種別マスタ候補から必ず1つ選ぶ。",
    "- payment_destination_codeは処理先マスタ候補から必ず1つ選ぶ。",
    "- accounting_category_codeは会計区分マスタ候補から必ず1つ選ぶ。",
    "- analysis_system_codeは専門解析先マスタ候補から必ず1つ選ぶ。",
    "- 選択区分に空文字、null、日本語ラベル、独自コードを返さない。",

    "- payable_kind_code、source_type_code、specialist_route_code、specialist_route_label、document_groupは返さない。",
    "- analysis_system_reasonは必ず具体的に返す。",
    "- analysis_system_confidenceはhigh、medium、lowのいずれかを返す。",
    "- needs_reviewは必ずtrueまたはfalseのbooleanで返す。",
    "- 判断に迷う場合も有効なマスタコードを選び、needs_review=trueにする。",
    "- Node.js、SQL、HTML、固定語句、既定値、後付け補正を前提にしない。",
    "- OCR本文にない情報を作らない。",
    "",
    "返すJSON形式:",
    "{",
    '  "company_id": 0,',
    '  "company_code": "",',
    '  "document_type_code": "",',
    '  "payment_destination_code": "",',
    '  "accounting_category_code": "",',
    '  "analysis_system_code": "",',
    '  "analysis_system_reason": "",',
    '  "analysis_system_confidence": "high",',
    '  "needs_review": false,',
    '  "warnings": []',
    "}",
    "",
    "上記10項目以外は返さない。",
    "JSON以外の文章は返さない。",
    "",
    "OCR本文:",
    "------------------------------",
    String(ocrText || "").slice(0, 12000),
    "------------------------------"
  ].join("\n");
}
function buildPaymentDocumentDetailPrompt(ocrText, classification) {
  return [
    "あなたは支払書類のStage2共通基本情報抽出AIです。",
    "画像は見ず、OCR本文に明記された基本情報だけを抽出してください。",
    "Stage1の分類結果を変更または再判定してはいけません。",
    "",
    "Stage1結果:",
    JSON.stringify(classification || {}, null, 2),
    "",
    "抽出する基本10項目:",
    "- document_number",
    "- reference_number",
    "- issuer_name",
    "- issuer_registration_number",
    "- issuer_postal_code",
    "- issuer_address",
    "- issuer_phone",
    "- recipient_name",
    "- recipient_code",
    "- document_date",
    "",
    "絶対ルール:",
    "- OCR本文にない情報を作らない。",
    "- 推測や補完をしない。",
    "- 不明な項目は空文字にする。",
    "- document_dateは明確な場合だけYYYY-MM-DD形式にする。",
    "- 金額、税額、支払期限、支払日、支払方法を抽出しない。",
    "- 明細、摘要、契約内容、保険内容、専門解析項目を抽出しない。",
    "- Stage1のマスタコードを返さない。",
    "- stage2_fieldsには基本10項目以外を入れない。",
    "",
    "返すJSON形式:",
    "{",
    '  "stage2_fields": {',
    '    "document_number": "",',
    '    "reference_number": "",',
    '    "issuer_name": "",',
    '    "issuer_registration_number": "",',
    '    "issuer_postal_code": "",',
    '    "issuer_address": "",',
    '    "issuer_phone": "",',
    '    "recipient_name": "",',
    '    "recipient_code": "",',
    '    "document_date": ""',
    "  },",
    '  "warnings": []',
    "}",
    "",
    "JSON以外の文章は返さない。",
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
          content: await appendPaymentDocumentExternalPrompt(appendPaymentDocumentMasterCodeInstruction(prompt), ["business-rules.txt", "legacy.extra-rules.txt"])
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

function normalizeStage1ClassificationCandidate(
  value,
  sourceTypeCode
) {
  const result =
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? value
      : {};

  const confidence = String(
    result.analysis_system_confidence || ""
  ).trim().toLowerCase();

  if (
    confidence &&
    !["high", "medium", "low"].includes(confidence)
  ) {
    const error = new Error(
      "Stage1のAI信頼度コードが不正です: " +
      confidence
    );

    error.statusCode = 422;
    throw error;
  }

  if (typeof result.needs_review !== "boolean") {
    const error = new Error(
      "Stage1のneeds_reviewはboolean必須です。"
    );

    error.statusCode = 422;
    throw error;
  }

  return {
    company_code: String(
      result.company_code || ""
    ).trim(),

    document_type_code: String(
      result.document_type_code || ""
    ).trim(),

    payment_destination_code: String(
      result.payment_destination_code || ""
    ).trim(),

    accounting_category_code: String(
      result.accounting_category_code || ""
    ).trim(),

    analysis_system_code: String(
      result.analysis_system_code || ""
    ).trim(),

    analysis_system_reason: String(
      result.analysis_system_reason || ""
    ).trim(),

    analysis_system_confidence:
      confidence,

    needs_review:
      result.needs_review,

    source_type_code: String(
      sourceTypeCode || ""
    ).trim(),

    warnings: Array.isArray(result.warnings)
      ? result.warnings
          .map(item =>
            String(item || "").trim()
          )
          .filter(Boolean)
      : []
  };
}

async function validateStage1MasterCodes(
  classification
) {
  const requiredValues = {
    company_code: String(
      classification.company_code || ""
    ).trim(),

    document_type_code: String(
      classification.document_type_code || ""
    ).trim(),

    payment_destination_code: String(
      classification.payment_destination_code || ""
    ).trim(),

    accounting_category_code: String(
      classification.accounting_category_code || ""
    ).trim(),

    analysis_system_code: String(
      classification.analysis_system_code || ""
    ).trim(),

    source_type_code: String(
      classification.source_type_code || ""
    ).trim()
  };

  for (const [fieldName, code] of Object.entries(requiredValues)) {
    if (!code) {
      const error = new Error(
        "Stage1必須マスタコードが空です: " +
        fieldName
      );

      error.statusCode = 422;
      throw error;
    }
  }

  const result = await db.query(`
    SELECT
      'company_code' AS field_name,
      company_code AS code
    FROM expenses.companies
    WHERE is_active = true

    UNION ALL

    SELECT
      'document_type_code',
      document_type_code
    FROM expenses.document_types
    WHERE is_active = true

    UNION ALL

    SELECT
      'payment_destination_code',
      payment_destination_code
    FROM expenses.payment_destinations
    WHERE is_active = true

    UNION ALL

    SELECT
      'accounting_category_code',
      accounting_category_code
    FROM expenses.accounting_categories
    WHERE is_active = true

    UNION ALL

    SELECT
      'analysis_system_code',
      analysis_system_code
    FROM expenses.analysis_systems
    WHERE is_active = true

    UNION ALL

    SELECT
      'source_type_code',
      payment_source_type_code
    FROM expenses.payment_source_types
    WHERE is_active = true
  `);

  const activeCodes = new Map();

  for (const row of result.rows) {
    const fieldName = String(
      row.field_name || ""
    ).trim();

    const code = String(
      row.code || ""
    ).trim();

    if (!activeCodes.has(fieldName)) {
      activeCodes.set(
        fieldName,
        new Set()
      );
    }

    if (code) {
      activeCodes
        .get(fieldName)
        .add(code);
    }
  }

  for (const [fieldName, code] of Object.entries(requiredValues)) {
    const fieldCodes =
      activeCodes.get(fieldName) ||
      new Set();

    if (!fieldCodes.has(code)) {
      const error = new Error(
        "Stage1の選択値が有効なマスタコードではありません。" +
        " field=" + fieldName +
        " code=" + code
      );

      error.statusCode = 422;
      throw error;
    }
  }

  return classification;
}

async function resolvePaymentDocumentSourceTypeCode(row) {
  const result = await db.query(`
    SELECT
      payment_source_type_code
    FROM expenses.payment_source_types
    WHERE is_active = true
      AND COALESCE(payment_source_type_code, '') <> ''
    ORDER BY sort_order, payment_source_type_id
  `);

  const activeCodes = new Set(
    result.rows.map(item =>
      String(
        item.payment_source_type_code || ""
      ).trim()
    )
  );

  const sourceType = String(
    row && row.source_type || ""
  ).trim().toLowerCase();

  const mimeType = String(
    row && row.mime_type || ""
  ).trim().toLowerCase();

  let resolvedCode = "";

  if (activeCodes.has(sourceType)) {
    resolvedCode = sourceType;
  } else if (
    sourceType.includes("mail")
  ) {
    resolvedCode = "mail_saved";
  } else if (
    sourceType.includes("web")
  ) {
    resolvedCode = "web_download";
  } else if (
    sourceType.includes("manual")
  ) {
    resolvedCode = "manual_upload";
  } else if (
    mimeType === "application/pdf"
  ) {
    resolvedCode = "pdf_upload";
  } else if (
    sourceType === "scan_inbox" ||
    sourceType === "scan" ||
    sourceType === "image_upload" ||
    mimeType.startsWith("image/")
  ) {
    resolvedCode = "scan_upload";
  }

  if (
    !resolvedCode ||
    !activeCodes.has(resolvedCode)
  ) {
    const error = new Error(
      "入手元区分を有効なマスタコードへ確定できません。" +
      " source_type=" + sourceType +
      " mime_type=" + mimeType +
      " resolved_code=" + resolvedCode
    );

    error.statusCode = 422;
    throw error;
  }

  return resolvedCode;
}

function normalizeStage2CommonFieldsCandidate(value) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};

  const fields =
    source.stage2_fields &&
    typeof source.stage2_fields === "object" &&
    !Array.isArray(source.stage2_fields)
      ? source.stage2_fields
      : source;

  const text = key => String(fields[key] || "").trim();

  return {
    document_number: text("document_number"),
    reference_number: text("reference_number"),
    issuer_name: text("issuer_name"),
    issuer_registration_number: text("issuer_registration_number"),
    issuer_postal_code: text("issuer_postal_code"),
    issuer_address: text("issuer_address"),
    issuer_phone: text("issuer_phone"),
    recipient_name: text("recipient_name"),
    recipient_code: text("recipient_code"),
    document_date: text("document_date"),
    warnings: Array.isArray(source.warnings)
      ? source.warnings.map(item => String(item || "").trim()).filter(Boolean)
      : []
  };
}

async function createTwoStepBasicAnalysisFromOcrText(ocrText, context = {}) {
  const companyId = Number(
    context && context.company_id || 0
  );

  const companyCode = String(
    context && context.company_code || ""
  ).trim();

  if (
    !Number.isInteger(companyId) ||
    companyId < 1 ||
    !companyCode
  ) {
    const error = new Error(
      "プロジェクト入口で確定した会社情報がありません。"
    );

    error.statusCode = 422;
    throw error;
  }
  const sourceTypeCode = String(
    context && context.source_type_code || ""
  ).trim();

  if (!sourceTypeCode) {
    const error = new Error(
      "システム確定済みの入手元区分マスタコードがありません。"
    );

    error.statusCode = 422;
    throw error;
  }
  const classificationPrompt = await appendPaymentDocumentExternalPrompt(
    buildPaymentDocumentClassificationPrompt(
      ocrText,
      {
        company_id: companyId,
        company_code: companyCode
      }
    ),
    await selectPaymentDocumentPromptFiles({
      ocrText,
      phase: "classification"
    })
  );

  const classificationResponse = await callPaymentDocumentOpenAiJson(
    classificationPrompt,
    await loadPaymentDocumentPromptTextFromDb(
      "classification.system.txt",
      "OCR本文だけから、支払書類の分類JSONを作成してください。必ずJSONのみを返してください。"
    )
  );

  const classification =
    normalizeStage1ClassificationCandidate(
      classificationResponse.parsed,
      sourceTypeCode
    );

  const returnedCompanyId = Number(
    classificationResponse &&
    classificationResponse.parsed &&
    classificationResponse.parsed.company_id ||
    0
  );

  const returnedCompanyCode = String(
    classification &&
    classification.company_code ||
    ""
  ).trim();

  if (
    returnedCompanyId !== companyId ||
    returnedCompanyCode !== companyCode
  ) {
    const error = new Error(
      "AI返却会社が入口の正式会社と一致しません。" +
      " expected_company_id=" + companyId +
      " returned_company_id=" + returnedCompanyId +
      " expected_company_code=" + companyCode +
      " returned_company_code=" + returnedCompanyCode
    );

    error.statusCode = 422;
    throw error;
  }

  classification.company_id = companyId;

  await validateStage1MasterCodes(
    classification
  );
  const visibleLabels = [
    "document_number",
    "reference_number",
    "issuer_name",
    "issuer_registration_number",
    "issuer_postal_code",
    "issuer_address",
    "issuer_phone",
    "recipient_name",
    "recipient_code",
    "document_date"
  ];

  const detailPrompt = await appendPaymentDocumentExternalPrompt(
    buildPaymentDocumentDetailPrompt(ocrText, classification),
    await selectPaymentDocumentPromptFiles({
      ocrText,
      analysis: classification,
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

  const detail = normalizeStage2CommonFieldsCandidate(
    detailResponse.parsed
  );

  const { warnings: detailWarnings, ...stage2Fields } = detail;

  const analysis = {
    ...stage2Fields,
    company_id: classification.company_id,
    company_code: classification.company_code,
    document_type_code: classification.document_type_code,
    payment_destination_code: classification.payment_destination_code,
    accounting_category_code: classification.accounting_category_code,
    analysis_system_code: classification.analysis_system_code,
    analysis_system_reason: classification.analysis_system_reason,
    analysis_system_confidence: classification.analysis_system_confidence,
    needs_review: classification.needs_review,
    source_type_code: classification.source_type_code,
    fields: { ...stage2Fields },
    warnings: [
      ...(Array.isArray(classification.warnings) ? classification.warnings : []),
      ...(Array.isArray(detailWarnings) ? detailWarnings : [])
    ]
  };

  // 画面の表示項目は、ここで生成した visibleLabels をそのまま保存・利用する
  analysis.visible_field_labels = visibleLabels;
  return {
    analysis,
    classification,
    visible_field_labels: analysis.visible_field_labels || visibleLabels,
    display_mode: "visible_fields_only",
    prompt_rule_files: {
      classification: await selectPaymentDocumentPromptFiles({
        ocrText,
        phase: "classification"
      }),
      detail: await selectPaymentDocumentPromptFiles({
        ocrText,
        analysis: classification,
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

async function createPaymentDocumentSpecialistAnalysisFromOcrText(ocrText, context = {}) {
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

  /* HD_ORIGIN_GPT2_CIL_AI_MASTER_CONTEXT_20260722_START */
  let specialistMasterOptions = {};

  if (analysisSystemCode === "contract_insurance_lease_analysis") {
    const leaseItemCategoryResult = await db.query(`
      SELECT
        lease_item_category_code,
        lease_item_category_name
      FROM expenses.lease_item_categories
      WHERE is_active = TRUE
      ORDER BY sort_order, lease_item_category_id
    `);

    specialistMasterOptions = {
      lease_item_categories: leaseItemCategoryResult.rows.map(row => ({
        code: String(row.lease_item_category_code || "").trim(),
        label: String(row.lease_item_category_name || "").trim()
      }))
    };
  }
  /* HD_ORIGIN_GPT2_CIL_AI_MASTER_CONTEXT_20260722_END */

  const specialistContext = {
    phase: "specialist",
    /* HD_ORIGIN_SPECIALIST_ANALYSIS_CODE_CONTEXT_20260723 */
    specialist_analysis_code: specialistRouteCode,
    specialist_route_code: specialistRouteCode,
    specialist_route_label: specialistRouteLabel,
    analysis_system_code: analysisSystemCode,
    analysis_system_label: analysisSystemLabel,
    group: String(context.group || "").trim(),
    master_options: specialistMasterOptions,
    analysis: hdOriginAiOnlyObject(
      context.analysis ||
      context.classification
    )
  };

  const prompt = await appendPaymentDocumentExternalPrompt(
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
      '  "analysis": {',
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
    await selectPaymentDocumentPromptFiles(specialistContext)
  );

  const response = await callPaymentDocumentOpenAiJson(
    prompt,
    loadPaymentDocumentPromptText(
      "stage3-specialist/common/system.txt",
      "OCR本文だけから専門解析JSONを作成してください。表示項目はvisible_field_labelsでAIが決めてください。必ずJSONのみを返してください。"
    )
  );

  const parsed = hdOriginAiOnlyObject(response.parsed);
  const rawAnalysis = hdOriginAiOnlyObject(parsed.analysis || parsed);
  const analysis = { ...rawAnalysis };
  const fields = hdOriginAiOnlyObject(rawAnalysis.fields || parsed.fields);

  analysis.fields = fields;

  analysis.visible_field_labels = hdOriginAiOnlyArray(
    parsed.visible_field_labels ||
    parsed.visibleFieldLabels ||
    rawAnalysis.visible_field_labels ||
    rawAnalysis.visibleFieldLabels
  );

  analysis.document_group = String(
    rawAnalysis.document_group || ""
  ).trim();

  analysis.specialist_route_code = String(
    rawAnalysis.specialist_route_code || ""
  ).trim();

  analysis.specialist_route_label = String(
    rawAnalysis.specialist_route_label || ""
  ).trim();

  analysis.analysis_system_code = String(
    rawAnalysis.analysis_system_code || ""
  ).trim();

  analysis.analysis_system_label = String(
    rawAnalysis.analysis_system_label || ""
  ).trim();

  const requiredAiFields = [
    ["analysis.document_group", analysis.document_group],
    ["analysis.specialist_route_code", analysis.specialist_route_code],
    ["analysis.analysis_system_code", analysis.analysis_system_code]
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
    analysis.warnings = parsed.warnings;
  }

  return {
    analysis,
    classification: specialistContext.analysis,
    specialist: parsed,
    document_group: analysis.document_group,
    visible_field_labels: analysis.visible_field_labels,
    display_mode: "ai_decides_visible_fields",
    image_used: false,
    prompt_rule_files: {
      specialist: await selectPaymentDocumentPromptFiles(specialistContext)
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

function buildPaymentDocumentSortPrompt(context) {
  const input =
    context && typeof context === "object"
      ? context
      : {};

  return [
    "次の固定入力情報、正式マスタ候補、OCR本文を使用して、支払書類の1回目解析を行ってください。",
    "判定ルールと返却JSON形式はsystemプロンプトに従ってください。",
    "company_idとsource_type_codeは取込時に確定済みの固定値です。",
    "company_idとsource_type_codeを選び直したり変更したりしてはいけません。",
    "document_type_codeはcandidate_document_typesから選んでください。",
    "analysis_system_codeはcandidate_specialistsから選んでください。",
    "候補にないコードを作ってはいけません。",
    "画像は使用せず、OCR本文だけを証憑内容の根拠にしてください。",
    "",
    "company_id:",
    String(input.companyId || ""),
    "",
    "source_type_code:",
    String(input.sourceTypeCode || ""),
    "",
    "candidate_document_types:",
    JSON.stringify(
      Array.isArray(input.documentTypes)
        ? input.documentTypes
        : [],
      null,
      2
    ),
    "",
    "candidate_specialists:",
    JSON.stringify(
      Array.isArray(input.specialists)
        ? input.specialists
        : [],
      null,
      2
    ),
    "",
    "OCR本文:",
    "------------------------------",
    paymentDocumentSortCompactOcrText(input.ocrText),
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
function normalizePaymentDocumentAnalysisCandidate(value) {
  const raw = value && typeof value === "object" ? value : {};
  const source =
    raw.analysis && typeof raw.analysis === "object" ? raw.analysis :
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

/* HD_ORIGIN_PAYMENT_DOCUMENT_SPECIALIST_ANALYSIS_SAVE_API_20260707_START */
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

async function hdOriginSaveUtilityCommunicationSpecialistResult(body, transactionClient) {
  const ocrId = Number(
    body.paymentDocumentOcrImportId ||
    body.payment_document_ocr_import_id ||
    body.ocrImportId ||
    body.id
  );

  if (!Number.isInteger(ocrId) || ocrId < 1) {
    const err = new Error("不正なOCR取込IDです。");
    err.statusCode = 400;
    throw err;
  }

  const ownsTransaction = !transactionClient;
  const client = transactionClient || await db.connect();

  try {
    if (ownsTransaction) {
      await client.query("BEGIN");
    }

    const ocr = await client.query(`
      SELECT latest_specialist_analysis_id
      FROM accounting.payment_document_ocr_imports
      WHERE payment_document_ocr_import_id = $1
        AND deleted_at IS NULL
    `, [ocrId]);

    if (!ocr.rows.length) {
      const err = new Error("OCR取込データが見つかりません。");
      err.statusCode = 404;
      throw err;
    }

    const specialistAnalysisId = hdOriginCilNumberOrNull(
      body.specialistAnalysisId ||
        body.specialist_analysis_id ||
        body.latestSpecialistAnalysisId ||
        body.latest_specialist_analysis_id ||
        ocr.rows[0].latest_specialist_analysis_id
    );

    const fields = hdOriginCilFirstObject(
      body.specialistFields,
      body.specialist_fields,
      body.fields,
      body.visibleFields,
      body.visible_fields,
      {}
    );

    const root = hdOriginCilFirstObject(
      body.rawResult,
      body.raw_result,
      body
    );

    const aiSummary = hdOriginCilFirstObject(
      body.aiSummary,
      body.ai_summary,
      {}
    );

    const field = (code, ...labels) =>
      fields[code] ?? hdOriginCilField(fields, ...labels);

    const version = await client.query(`
      SELECT COALESCE(MAX(result_version), 0) + 1 AS next_version
      FROM accounting.payment_document_utility_communication_results
      WHERE payment_document_ocr_import_id = $1
    `, [ocrId]);

    await client.query(`
      UPDATE accounting.payment_document_utility_communication_results
      SET is_current = FALSE, updated_at = now()
      WHERE payment_document_ocr_import_id = $1
        AND is_current = TRUE
        AND deleted_at IS NULL
    `, [ocrId]);

    const saved = await client.query(`
      INSERT INTO accounting.payment_document_utility_communication_results (
        payment_document_ocr_import_id,
        specialist_analysis_id,
        result_no,
        result_version,
        customer_number,
        supply_point_number,
        meter_reading_date,
        usage_quantity,
        usage_unit,
        specialist_fields_json,
        ai_summary_json,
        ai_raw_json,
        visible_fields_json,
        human_corrections_json,
        warnings_json,
        created_by_page,
        created_by,
        updated_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10::jsonb,$11::jsonb,$12::jsonb,
        $13::jsonb,$14::jsonb,$15::jsonb,
        $16,$17,$18
      )
      RETURNING utility_communication_result_id
    `, [
      ocrId,
      specialistAnalysisId,
      "UCD-" + ocrId + "-" + Date.now(),
      Number(version.rows[0].next_version),
      hdOriginCilText(
        field("customer_number","お客様番号","公共料金お客様番号")
      ),
      hdOriginCilText(
        field("supply_point_number","供給地点番号")
      ),
      hdOriginCilDateOrNull(
        field("meter_reading_date","検針日")
      ),
      hdOriginCilNumberOrNull(
        field("usage_quantity","使用量")
      ),
      hdOriginCilText(
        field("usage_unit","使用量単位")
      ),
      JSON.stringify(fields),
      JSON.stringify(aiSummary),
      JSON.stringify(root),
      JSON.stringify(body.visibleFields || body.visible_fields || fields),
      JSON.stringify(body.humanCorrections || body.human_corrections || {}),
      JSON.stringify(Array.isArray(body.warnings) ? body.warnings : []),
      "payment-document-specialist-utility-communication.html",
      "system",
      "system"
    ]);

    /* HD_ORIGIN_UTILITY_LINE_ITEMS_SAVE_20260723_START */
    const utilityResultId =
      saved.rows[0].utility_communication_result_id;

    const lineItems =
      Array.isArray(body.lineItems) ? body.lineItems :
      Array.isArray(body.line_items) ? body.line_items :
      Array.isArray(fields.line_items) ? fields.line_items :
      Array.isArray(fields.lineItems) ? fields.lineItems :
      [];

    for (let index = 0; index < lineItems.length; index += 1) {
      const line =
        lineItems[index] && typeof lineItems[index] === "object"
          ? lineItems[index]
          : {};

      await client.query(`
        INSERT INTO accounting.payment_document_utility_communication_line_items (
          utility_communication_result_id,
          line_no,
          item_name,
          description,
          usage_quantity,
          usage_unit,
          unit_price,
          subtotal_amount,
          tax_category_id,
          tax_rate,
          tax_amount,
          total_amount,
          source_text,
          raw_item_json
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$9,$10,$11,$12,$13,$14::jsonb
        )
      `, [
        utilityResultId,
        Number(line.line_no || line.lineNo || index + 1),
        hdOriginCilText(line.item_name || line.name),
        hdOriginCilText(line.description),
        hdOriginCilNumberOrNull(line.usage_quantity ?? line.quantity),
        hdOriginCilText(line.usage_unit || line.unit),
        hdOriginCilNumberOrNull(line.unit_price ?? line.unitPrice),
        hdOriginCilNumberOrNull(line.subtotal_amount ?? line.amount),
        hdOriginCilNumberOrNull(line.tax_category_id ?? line.taxCategoryId),
        hdOriginCilNumberOrNull(line.tax_rate ?? line.taxRate),
        hdOriginCilNumberOrNull(line.tax_amount ?? line.taxAmount),
        hdOriginCilNumberOrNull(line.total_amount ?? line.totalAmount),
        hdOriginCilText(line.source_text ?? line.memo),
        JSON.stringify(line)
      ]);
    }
    /* HD_ORIGIN_UTILITY_LINE_ITEMS_SAVE_20260723_END */
    if (ownsTransaction) {
      await client.query("COMMIT");
    }

    return {
      ok: true,
      specialistAnalysisId
    };
  } catch (err) {
    if (ownsTransaction) {
      await client.query("ROLLBACK");
    }
    throw err;
  } finally {
    if (ownsTransaction) {
      client.release();
    }
  }
}
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

async function handlePaymentDocumentRoutes(req, res) {
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
  if (
    req.method === "GET" &&
    String(req.url || "").split("?")[0] ===
      "/api/payment-documents/review-items"
  ) {
    try {
      const reviewItemsUrl = new URL(
        req.url || "/api/payment-documents/review-items",
        "http://localhost"
      );
      const specialistScope =
        reviewItemsUrl.searchParams.get("scope") === "specialist";
      const specialistAnalysisSystemCode = String(
        reviewItemsUrl.searchParams.get("analysis_system_code") || ""
      ).trim();

      if (specialistScope && !specialistAnalysisSystemCode) {
        sendJson(res, 400, {
          ok: false,
          error: "専門解析一覧にはanalysis_system_codeが必要です。"
        });
        return true;
      }

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
          o.current_status,
          o.sorted_at,
          o.created_at,
          o.updated_at,

          b.basic_analysis_id,
          b.company_id AS basic_company_id,
          b.ai_confidence AS basic_ai_confidence,
          b.ai_reason AS basic_ai_reason,
          b.needs_review AS basic_needs_review,
          b.warnings_json AS basic_warnings_json,
          b.raw_result_json AS basic_raw_result_json,
          b.analysis_completed AS basic_analysis_completed,
          b.completed_at AS basic_completed_at,
          b.created_at AS basic_created_at,
          b.updated_at AS basic_updated_at

        FROM
          accounting.payment_document_ocr_imports o

        LEFT JOIN
          accounting.payment_document_basic_analysis_results b
          ON b.payment_document_ocr_import_id =
             o.payment_document_ocr_import_id
         AND b.is_current = TRUE

        WHERE
          o.deleted_at IS NULL
          AND COALESCE(o.ocr_raw_text, '') <> ''
          AND (
            (
              $1 <> ''
              AND o.current_status = '専門解析待ち'
              AND b.raw_result_json->'analysis'->'sortResult'->>'analysis_system_code' = $1
            )
            OR (
              $1 = ''
              AND (
                o.current_status = '基礎解析済み'
                OR o.current_status = (
                  WITH ocr_phase AS (
                    SELECT MAX(display_order) AS last_ocr_order
                    FROM accounting.payment_document_current_statuses
                    WHERE is_active = TRUE
                      AND (
                        current_status LIKE 'OCR%'
                        OR COALESCE(description, '') LIKE '%OCR%'
                      )
                  )
                  SELECT current_status
                  FROM accounting.payment_document_current_statuses
                  CROSS JOIN ocr_phase
                  WHERE is_active = TRUE
                    AND is_processing = FALSE
                    AND is_terminal = FALSE
                    AND is_error = FALSE
                    AND display_order > ocr_phase.last_ocr_order
                  ORDER BY display_order
                  LIMIT 1
                )
              )
            )
          )

        ORDER BY
          o.sorted_at DESC NULLS LAST,
          o.saved_at DESC NULLS LAST,
          o.ocr_at DESC NULLS LAST,
          o.payment_document_ocr_import_id DESC

        LIMIT 500
      `, [specialistScope ? specialistAnalysisSystemCode : ""]);

      const objectOrEmpty = value =>
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
          ? value
          : {};

      const arrayOrEmpty = value =>
        Array.isArray(value)
          ? value
          : [];

      const items = result.rows.map(row => {
        const basicRawResult =
          objectOrEmpty(
            row.basic_raw_result_json
          );

        // Basic-analysis data is exposed only from the formal table schema.
        // Do not merge legacy or in-memory values into the review response.
        const basicAnalysis = objectOrEmpty(basicRawResult.analysis);
        const sortResult = objectOrEmpty(basicAnalysis.sortResult);
        const visibleFields = objectOrEmpty(basicAnalysis.visibleFields);
        const visibleFieldLabels = arrayOrEmpty(
          basicAnalysis.visibleFieldLabels
        );
        const aiSummary = objectOrEmpty(basicAnalysis.aiSummary);

        const latestBasicAnalysis =
          row.basic_analysis_id
            ? {
                basicAnalysisId:
                  row.basic_analysis_id,

                basic_analysis_id:
                  row.basic_analysis_id,

                paymentDocumentOcrImportId:
                  row.payment_document_ocr_import_id,

                payment_document_ocr_import_id:
                  row.payment_document_ocr_import_id,

                companyId:
                  row.basic_company_id,

                company_id:
                  row.basic_company_id,

                aiConfidence:
                  row.basic_ai_confidence,

                ai_confidence:
                  row.basic_ai_confidence,

                aiReason:
                  row.basic_ai_reason,

                ai_reason:
                  row.basic_ai_reason,

                needsReview:
                  !!row.basic_needs_review,

                needs_review:
                  !!row.basic_needs_review,

                warnings:
                  row.basic_warnings_json || [],

                warnings_json:
                  row.basic_warnings_json || [],

                rawResult:
                  basicRawResult,

                raw_result:
                  basicRawResult,

                sortResult:
                  sortResult,

                sort_result:
                  sortResult,

                visibleFields:
                  visibleFields,

                visible_fields:
                  visibleFields,

                visibleFieldLabels:
                  visibleFieldLabels,

                visible_field_labels:
                  visibleFieldLabels,

                aiSummary:
                  aiSummary,

                ai_summary:
                  aiSummary,

                analysisCompleted:
                  row.basic_analysis_completed === true,

                analysis_completed:
                  row.basic_analysis_completed === true,

                completedAt:
                  row.basic_completed_at,

                completed_at:
                  row.basic_completed_at,

                createdAt:
                  row.basic_created_at,

                created_at:
                  row.basic_created_at,

                updatedAt:
                  row.basic_updated_at,

                updated_at:
                  row.basic_updated_at
              }
            : null;

        const analysisSystemCode =
          String(
            sortResult.analysis_system_code ||
            sortResult.analysisSystemCode ||
            ""
          ).trim();

        return {
          source:
            "database-review-items-basic-analysis",

          paymentDocumentOcrImportId:
            row.payment_document_ocr_import_id,

          imageUrl:
            "/api/payment-documents/ocr-imports/file/" +
            encodeURIComponent(
              String(
                row.payment_document_ocr_import_id
              )
            ),

          fileName:
            row.saved_file_name ||
            row.original_file_name,

          originalFileName:
            row.original_file_name ||
            row.saved_file_name,

          savedFileName:
            row.saved_file_name,

          mimeType:
            row.mime_type,

          sizeBytes:
            row.size_bytes,

          sha256:
            row.sha256,

          documentType:
            row.document_type,

          destination:
            row.destination,

          sourceType:
            row.source_type,

          vendorName:
            row.vendor_name,

          note:
            row.note,

          emailSubject:
            row.email_subject,

          emailFrom:
            row.email_from,

          emailReceivedAt:
            row.email_received_at,

          ocrStatus:
            row.ocr_status || "ocr_done",

          ocrProvider:
            row.ocr_provider,

          ocrApiVersion:
            row.ocr_api_version,

          ocrAt:
            row.ocr_at,

          ocrRawText:
            row.ocr_raw_text,

          ocrTextPreview:
            String(
              row.ocr_raw_text || ""
            ).slice(0, 240),

          ocrTextLength:
            row.ocr_text_length,

          processStatus:
            row.process_status,

          saveStatus:
            row.save_status,

          savedStatus:
            row.save_status,

          evidenceSaved:
            row.evidence_saved,

          ocrSaved:
            row.ocr_saved,

          savedRelativePath:
            row.saved_relative_path,

          savedMetaRelativePath:
            row.saved_meta_relative_path,

          savedAt:
            row.saved_at,

          savedByPage:
            row.saved_by_page,

          currentStatus:
            row.current_status,

          resultStatus:
            row.current_status,

          sortedAt:
            row.sorted_at,

          latestBasicAnalysisId:
            row.basic_analysis_id,

          latestBasicAnalysis,

          analysisSystemCode,

          createdAt:
            row.created_at,

          updatedAt:
            row.updated_at
        };
      });

      sendJson(res, 200, {
        ok: true,
        source:
          specialistScope
            ? "database-specialist-waiting-items"
            : "database-review-items-basic-analysis",
        items
      });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        source:
          "database-review-items-basic-analysis",
        error:
          err.message ||
          String(err)
      });
    }

    return true;
  }
  /* HD_ORIGIN_PAYMENT_DOCUMENT_REVIEW_ITEMS_DB_ONLY_20260708_END */

  /* HD_ORIGIN_BASIC_ANALYSIS_BULK_ROUTE_TO_SPECIALIST_20260729_START */
  if (
    req.method === "POST" &&
    String(req.url || "").split("?")[0] ===
      "/api/payment-documents/basic-analysis/route-to-specialist-bulk"
  ) {
    const results = [];
    let body;

    try {
      body = await readBody(req);
      const companyId = Number(body.company_id || body.companyId || 0);
      const companyCode = String(
        body.company_code || body.companyCode || ""
      ).trim();
      const requestedIds = Array.isArray(
        body.payment_document_ocr_import_ids
      )
        ? body.payment_document_ocr_import_ids
        : [];
      const ocrImportIds = [
        ...new Set(
          requestedIds
            .map(value => Number(value))
            .filter(value => Number.isInteger(value) && value > 0)
        )
      ];

      if (!Number.isInteger(companyId) || companyId < 1 || !companyCode) {
        const error = new Error("company_id と company_code が必要です。");
        error.statusCode = 422;
        throw error;
      }

      if (!ocrImportIds.length) {
        const error = new Error("振り分け対象のOCR取込IDがありません。");
        error.statusCode = 400;
        throw error;
      }

      const activeSystemsResult = await db.query(`
        SELECT analysis_system_code
        FROM expenses.analysis_systems
        WHERE is_active = TRUE
      `);
      const activeAnalysisSystemCodes = new Set(
        activeSystemsResult.rows
          .map(row => String(row.analysis_system_code || "").trim())
          .filter(Boolean)
      );

      for (const ocrImportId of ocrImportIds) {
        let client;

        try {
          client = await db.connect();
          await client.query("BEGIN");

          const lockedResult = await client.query(`
            SELECT
              o.payment_document_ocr_import_id,
              o.current_status,
              b.basic_analysis_id,
              b.company_id,
              c.company_code,
              b.analysis_completed,
              b.raw_result_json->'analysis'->'sortResult'->>'analysis_system_code'
                AS analysis_system_code
            FROM accounting.payment_document_ocr_imports o
            LEFT JOIN accounting.payment_document_basic_analysis_results b
              ON b.payment_document_ocr_import_id =
                 o.payment_document_ocr_import_id
             AND b.is_current = TRUE
            LEFT JOIN expenses.companies c
              ON c.company_id = b.company_id
            WHERE o.payment_document_ocr_import_id = $1
              AND o.deleted_at IS NULL
            FOR UPDATE OF o
          `, [ocrImportId]);
          const row = lockedResult.rows[0];

          if (!row) {
            throw new Error("OCR取込レコードが見つかりません。");
          }

          if (
            Number(row.company_id) !== companyId ||
            String(row.company_code || "").trim() !== companyCode
          ) {
            throw new Error("対象会社が一致しません。");
          }

          if (row.current_status !== "基礎解析済み") {
            throw new Error("current_statusが基礎解析済みではありません。");
          }

          if (!row.basic_analysis_id || row.analysis_completed !== true) {
            throw new Error("最新の正式基礎解析結果が未完了です。");
          }

          const analysisSystemCode = String(
            row.analysis_system_code || ""
          ).trim();

          if (!analysisSystemCode) {
            throw new Error("analysis_system_codeがありません。");
          }

          if (!activeAnalysisSystemCodes.has(analysisSystemCode)) {
            throw new Error("analysis_system_codeが有効な専門解析システムではありません。");
          }

          const updatedResult = await client.query(`
            UPDATE accounting.payment_document_ocr_imports
            SET
              current_status = '専門解析待ち',
              sorted_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE payment_document_ocr_import_id = $1
              AND deleted_at IS NULL
              AND current_status = '基礎解析済み'
            RETURNING payment_document_ocr_import_id, current_status
          `, [ocrImportId]);

          if (updatedResult.rowCount !== 1) {
            throw new Error("専門解析待ちへの振り分け更新に失敗しました。");
          }

          await client.query("COMMIT");
          results.push({
            payment_document_ocr_import_id: ocrImportId,
            ok: true,
            analysis_system_code: analysisSystemCode,
            current_status: updatedResult.rows[0].current_status
          });
        } catch (error) {
          if (client) {
            try {
              await client.query("ROLLBACK");
            } catch {}
          }

          results.push({
            payment_document_ocr_import_id: ocrImportId,
            ok: false,
            error: error.message || String(error)
          });
        } finally {
          if (client) client.release();
        }
      }

      const success = results.filter(row => row.ok).length;

      sendJson(res, 200, {
        ok: true,
        total: ocrImportIds.length,
        success,
        failed: ocrImportIds.length - success,
        results
      });
    } catch (error) {
      sendJson(res, error.statusCode || 500, {
        ok: false,
        error: error.message || String(error),
        total: results.length,
        success: results.filter(row => row.ok).length,
        failed: results.filter(row => !row.ok).length,
        results
      });
    }

    return true;
  }
  /* HD_ORIGIN_BASIC_ANALYSIS_BULK_ROUTE_TO_SPECIALIST_20260729_END */

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
    const analysis = hdOriginSpecialistFirstObject(root.analysis, root.analysisResult, root.analysis_result, root.sorting, root.classification);
    const sortResult = hdOriginSpecialistFirstObject(root.sortResult, root.sort_result, root.result, analysis.sortResult, analysis.sort_result);
    const aiSummary = hdOriginSpecialistFirstObject(root.ai_summary, root.aiSummary, analysis.ai_summary, analysis.aiSummary, sortResult.ai_summary, sortResult.aiSummary);

    let ocrImportId = hdOriginSpecialistSaveNumber(
      root.paymentDocumentOcrImportId ||
      root.payment_document_ocr_import_id ||
      root.ocrImportId ||
      root.ocr_import_id ||
      root.id
    );
    const client = await db.connect();

    try {
      await client.query("BEGIN");

      let ocrImportRow = null;

      const fallbackAnalysisSystemCode = hdOriginSpecialistFirstText(
        root.analysisSystemCode,
        root.analysis_system_code,
        analysis.analysis_system_code,
        sortResult.analysis_system_code,
        aiSummary.analysis_system_code
      );

      const fallbackAnalysisSystemLabel = hdOriginSpecialistFirstText(
        root.analysisSystemLabel,
        root.analysis_system_label,
        analysis.analysis_system_label,
        analysis.specialist_route_label,
        sortResult.analysis_system_label,
        sortResult.specialist_route_label,
        aiSummary.analysis_system_label,
        aiSummary.analysis_system
      );

      const fallbackSpecialistRouteCode = hdOriginSpecialistFirstText(
        root.specialistRouteCode,
        root.specialist_route_code,
        analysis.specialist_route_code,
        sortResult.specialist_route_code,
        fallbackAnalysisSystemCode
      );

      const fallbackSpecialistRouteLabel = hdOriginSpecialistFirstText(
        root.specialistRouteLabel,
        root.specialist_route_label,
        analysis.specialist_route_label,
        sortResult.specialist_route_label,
        fallbackAnalysisSystemLabel
      );
      if (!ocrImportId) {
        const err = new Error(
          "専門解析結果の保存にはOCR取込IDが必要です。"
        );
        err.statusCode = 400;
        throw err;
      }

      const ocrResult = await client.query(`
        SELECT
          payment_document_ocr_import_id,
          latest_basic_analysis_id,
          latest_specialist_analysis_id,
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
        const err = new Error(
          "OCR取込レコードが見つかりません。"
        );
        err.statusCode = 404;
        throw err;
      }

      ocrImportId = Number(
        ocrImportRow.payment_document_ocr_import_id
      );

      /* HD_ORIGIN_SPECIALIST_BASIC_LINK_20260726 */
      const requestedBasicAnalysisId =
        hdOriginSpecialistSaveNumber(
          root.basicAnalysisId ||
          root.basic_analysis_id ||
          ocrImportRow.latest_basic_analysis_id
        ) || null;

      const basicResult = await client.query(`
        SELECT basic_analysis_id
        FROM accounting.payment_document_basic_analysis_results
        WHERE payment_document_ocr_import_id = $1
          AND is_current = TRUE
          AND (
            $2::bigint IS NULL
            OR basic_analysis_id = $2::bigint
          )
        ORDER BY basic_analysis_id DESC
        LIMIT 1
      `, [
        ocrImportId,
        requestedBasicAnalysisId
      ]);

      const basicAnalysisRow = basicResult.rows[0] || null;

      if (!basicAnalysisRow) {
        const err = new Error(
          "正式な基礎解析結果を確認できません。"
        );
        err.statusCode = 400;
        throw err;
      }

      const basicAnalysisId =
        Number(basicAnalysisRow.basic_analysis_id);

      const analysisSystemCode = hdOriginSpecialistFirstText(
        root.analysisSystemCode,
        root.analysis_system_code,
        analysis.analysis_system_code,
        sortResult.analysis_system_code,
        aiSummary.analysis_system_code,
        null,
      );

      if (!analysisSystemCode) {
        const err = new Error("analysis_system_code が取得できません。1回目解析の専門解析コードを確認してください。");
        err.statusCode = 400;
        throw err;
      }

      const analysisSystemLabel = hdOriginSpecialistFirstText(
        root.analysisSystemLabel,
        root.analysis_system_label,
        analysis.analysis_system_label,
        analysis.specialist_route_label,
        sortResult.analysis_system_label,
        sortResult.specialist_route_label,
        aiSummary.analysis_system_label,
        aiSummary.analysis_system,
        null,
        null
      );

      const aiConfidence = hdOriginSpecialistSaveNumber(
        root.aiConfidence ||
        root.ai_confidence ||
        analysis.ai_confidence ||
        analysis.confidence ||
        sortResult.ai_confidence ||
        sortResult.confidence
      );

      const aiReason = hdOriginSpecialistFirstText(
        root.aiReason,
        root.ai_reason,
        root.reason,
        analysis.ai_reason,
        analysis.reason,
        sortResult.ai_reason,
        sortResult.reason,
        aiSummary.reason
      );

      const warningsJson = hdOriginSpecialistSaveArray(
        root.warnings ||
        analysis.warnings ||
        sortResult.warnings
      );

      /*
       * HD_ORIGIN_GPT2_CIL_HUMAN_EDIT_RAW_RESULT_MERGE
       *
       * 契約・保険・リース画面で人間が修正した専門項目を、
       * 同じ専門解析結果のraw_result_jsonへ統合する。
       */
      const analysisResult = hdOriginSpecialistSaveObject(
        root.rawResult ||
        root.raw_result_json ||
        root.specialistResult ||
        root.specialist_result ||
        root.result ||
        root
      );

      const cilHumanFields = hdOriginSpecialistFirstObject(
        root.specialistFields,
        root.specialist_fields,
        root.visibleFields,
        root.visible_fields
      );

      const cilVisibleFieldLabels = hdOriginSpecialistSaveArray(
        root.visibleFieldLabels ||
        root.visible_field_labels
      );

      const rawResultJson =
        {
          analysis:
            analysisSystemCode === "contract_insurance_lease_analysis" &&
            Object.keys(cilHumanFields).length > 0
              ? {
                  ...analysisResult,
                  ...cilHumanFields
                }
              : analysisResult,

          ...(analysisSystemCode === "contract_insurance_lease_analysis" &&
          Object.keys(cilHumanFields).length > 0
            ? {
              specialist_fields:
                cilHumanFields,

              specialistFields:
                cilHumanFields,

              visible_fields:
                cilHumanFields,

              visibleFields:
                cilHumanFields,

              visible_field_labels:
                cilVisibleFieldLabels,

              visibleFieldLabels:
                cilVisibleFieldLabels
              }
            : {})
        };
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
        WHERE payment_document_ocr_import_id = $1
          AND analysis_system_code = $2
          AND is_current = TRUE
      `, [ocrImportId, analysisSystemCode]);

      const inserted = await client.query(`
        INSERT INTO accounting.payment_document_specialist_analysis_results (
          payment_document_ocr_import_id,
          basic_analysis_id,
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
          basic_analysis_id,
analysis_system_code,
          analysis_system_label,
          specialist_analysis_status,
          created_at,
          updated_at
      `, [
        ocrImportId,
        basicAnalysisId,
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
        UPDATE accounting.payment_document_ocr_imports
        SET
          latest_basic_analysis_id = $1,
          latest_specialist_analysis_id = $2,
          current_status = '専門解析',
          updated_at = now()
        WHERE payment_document_ocr_import_id = $3
          AND deleted_at IS NULL
      `, [
        basicAnalysisId,
        saved.specialist_analysis_id,
        ocrImportId
      ]);

      if (analysisSystemCode === "utility_communication_analysis") {
        await hdOriginSaveUtilityCommunicationSpecialistResult({
          ...root,
          paymentDocumentOcrImportId: ocrImportId,
          payment_document_ocr_import_id: ocrImportId,
          specialistAnalysisId: saved.specialist_analysis_id,
          specialist_analysis_id: saved.specialist_analysis_id,
          specialistFields: hdOriginSpecialistFirstObject(
            root.specialistFields,
            root.specialist_fields,
            root.fields,
            root.visibleFields,
            root.visible_fields
          ),
          rawResult: rawResultJson,
          raw_result: rawResultJson,
          warnings: warningsJson
        }, client);
      }
await client.query("COMMIT");

      return {
        saved,
        paymentDocumentOcrImportId: ocrImportId,
        basicAnalysisId,
        specialistAnalysisId: saved.specialist_analysis_id,
        analysisSystemCode,
        analysisSystemLabel,
        specialistAnalysisStatus: specialistStatus
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

    if (req.method === "POST" && String(req.url || "").split("?")[0] === "/api/payment-documents/specialist-analysis-results/save") {
    try {
      const body = await readBody(req);
      const saved = await hdOriginSavePaymentDocumentSpecialistAnalysisResult(body);

      sendJson(res, 200, {
        ok: true,
        message: "専門解析結果を保存しました。",
        paymentDocumentOcrImportId: saved.paymentDocumentOcrImportId,
        specialistAnalysisId: saved.specialistAnalysisId,
        specialist_analysis_id: saved.specialistAnalysisId,
        latestSpecialistAnalysisId: saved.specialistAnalysisId,
        analysisSystemCode: saved.analysisSystemCode,
        analysisSystemLabel: saved.analysisSystemLabel,
        specialistAnalysisStatus: saved.specialistAnalysisStatus,
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

  
  /* HD_ORIGIN_BASIC_ANALYSIS_DIRECT_SAVE_ROUTE_20260727_START */
  if (req.method === "POST") {
    const basicAnalysisUrlPath = String(req.url || "").split("?")[0];

    if (basicAnalysisUrlPath.startsWith("/api/payment-documents/ai-basic-analysis/")) {
      let client;

      try {
        const idText = decodeURIComponent(
          basicAnalysisUrlPath.replace("/api/payment-documents/ai-basic-analysis/", "")
        ).trim();
        const ocrImportId = Number(idText);
        const body = await readBody(req);
        const companyId = Number(body.company_id || body.companyId || 0);
        const companyCode = String(body.company_code || body.companyCode || "").trim();

        if (!Number.isInteger(ocrImportId) || ocrImportId < 1) {
          const error = new Error("OCR取込IDが不正です。");
          error.statusCode = 400;
          throw error;
        }

        if (!Number.isInteger(companyId) || companyId < 1 || !companyCode) {
          const error = new Error("company_id と company_code が必要です。");
          error.statusCode = 422;
          throw error;
        }

        const ocrResult = await db.query(`
          SELECT
            payment_document_ocr_import_id,
            ocr_raw_text,
            source_type,
            mime_type
          FROM accounting.payment_document_ocr_imports
          WHERE payment_document_ocr_import_id = $1
            AND deleted_at IS NULL
          LIMIT 1
        `, [ocrImportId]);
        const ocrRow = ocrResult.rows[0];

        if (!ocrRow) {
          const error = new Error("OCR取込レコードが見つかりません。");
          error.statusCode = 404;
          throw error;
        }

        const ocrText = String(ocrRow.ocr_raw_text || "").trim();
        const sourceTypeCode = await resolvePaymentDocumentSourceTypeCode(ocrRow);

        if (!ocrText) {
          const error = new Error("OCR本文が空です。");
          error.statusCode = 400;
          throw error;
        }

        const aiResult = await createTwoStepBasicAnalysisFromOcrText(ocrText, {
          company_id: companyId,
          company_code: companyCode,
          source_type_code: sourceTypeCode
        });
        const classification = aiResult.classification || {};
        const detail = aiResult.analysis || {};
        const warnings = Array.isArray(detail.warnings) ? detail.warnings : [];
        const documentGroup = String(
          detail.document_group ||
          detail.specialist_route_code ||
          classification.document_group ||
          ""
        ).trim();
        const analysisSystemCode = String(
          detail.analysis_system_code ||
          classification.analysis_system_code ||
          ""
        ).trim();
        const analysisSystemLabel = String(
          detail.analysis_system_label ||
          classification.analysis_system_label ||
          ""
        ).trim();
        const visibleFieldLabels = Array.isArray(aiResult.visible_field_labels)
          ? aiResult.visible_field_labels
          : [];
        const confidenceValue = Number(
          classification.analysis_system_confidence ?? detail.ai_confidence
        );
        const aiConfidence = Number.isFinite(confidenceValue)
          ? confidenceValue
          : null;
        const basicAnalysisResult = {
          paymentDocumentOcrImportId: ocrImportId,
          companyId,
          companyCode,
          analysisSystemCode,
          analysisSystemLabel,
          documentGroup,
          visibleFieldLabels,
          classification,
          detail,
          warnings,
          sortResult: detail,
          visibleFields: detail.fields || {},
          aiSummary: classification,
          rawResult: {
            classification,
            detail
          },
          issuedAt: detail.document_date || ""
        };

        client = await db.connect();
        await client.query("BEGIN");

        const lockedOcrResult = await client.query(`
          SELECT payment_document_ocr_import_id, current_status
          FROM accounting.payment_document_ocr_imports
          WHERE payment_document_ocr_import_id = $1
            AND deleted_at IS NULL
          FOR UPDATE
        `, [ocrImportId]);
        const lockedOcrRow = lockedOcrResult.rows[0];

        if (!lockedOcrRow) {
          const error = new Error("OCR取込レコードが見つかりません。");
          error.statusCode = 404;
          throw error;
        }

        await client.query(`
          UPDATE accounting.payment_document_basic_analysis_results
          SET is_current = FALSE, updated_at = CURRENT_TIMESTAMP
          WHERE payment_document_ocr_import_id = $1
            AND is_current = TRUE
        `, [ocrImportId]);
        await client.query(`
          LOCK TABLE accounting.payment_document_basic_analysis_results
          IN SHARE ROW EXCLUSIVE MODE
        `);

        const inserted = await client.query(`
          INSERT INTO accounting.payment_document_basic_analysis_results (
            payment_document_ocr_import_id, company_id, document_type_id,
            specialist_analysis_id, ai_confidence, ai_reason, needs_review,
            warnings_json, raw_result_json, candidate_masters_snapshot_json,
            output_schema_snapshot_json, prompt_snapshot, model_name,
            prompt_version, is_current, analysis_completed, started_at,
            completed_at, created_at, updated_at
          ) VALUES (
            $1, $2, NULL, NULL, $3, $4, $5, $6::jsonb, $7::jsonb,
            $8::jsonb, $9::jsonb, NULL, NULL, NULL, TRUE, TRUE,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING basic_analysis_id, payment_document_ocr_import_id,
            is_current, analysis_completed, completed_at
        `, [
          ocrImportId,
          companyId,
          aiConfidence,
          classification.analysis_system_reason || detail.ai_reason || "",
          detail.needs_review === true || classification.needs_review === true,
          JSON.stringify(warnings),
          JSON.stringify({ analysis: basicAnalysisResult }),
          JSON.stringify({ classification }),
          JSON.stringify({ detail, visibleFieldLabels })
        ]);
        const saved = inserted.rows[0];

        const statusUpdated = await client.query(`
          UPDATE accounting.payment_document_ocr_imports
          SET latest_basic_analysis_id = $2,
              current_status = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE payment_document_ocr_import_id = $1
            AND deleted_at IS NULL
          RETURNING payment_document_ocr_import_id, current_status, sorted_at
        `, [ocrImportId, saved.basic_analysis_id, "基礎解析済み"]);

        if (statusUpdated.rowCount !== 1) {
          throw new Error("OCR取込状態を更新できませんでした。");
        }

        await client.query("COMMIT");

        sendJson(res, 200, {
          ok: true,
          basicAnalysisId: saved.basic_analysis_id,
          basic_analysis_id: saved.basic_analysis_id,
          paymentDocumentOcrImportId: saved.payment_document_ocr_import_id,
          payment_document_ocr_import_id: saved.payment_document_ocr_import_id,
          basicAnalysisResult,
          visibleFieldLabels,
          visible_field_labels: visibleFieldLabels,
          aiSteps: aiResult.steps || [],
          ai_steps: aiResult.steps || [],
          documentGroup,
          document_group: documentGroup,
          analysisSystemCode,
          analysis_system_code: analysisSystemCode,
          analysisSystemLabel,
          analysis_system_label: analysisSystemLabel,
          currentStatus: statusUpdated.rows[0].current_status,
          current_status: statusUpdated.rows[0].current_status
        });
      } catch (error) {
        if (client) {
          try {
            await client.query("ROLLBACK");
          } catch {}
        }

        sendJson(res, error.statusCode || 500, {
          ok: false,
          error: error.message || String(error)
        });
      } finally {
        if (client) client.release();
      }

      return true;
    }
  }
  /* HD_ORIGIN_BASIC_ANALYSIS_DIRECT_SAVE_ROUTE_20260727_END */
  

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
      /* HD_ORIGIN_UTILITY_LEDGER_GET_API_20260723_START */
  if (
    req.method === "GET" &&
    urlPath ===
      "/api/payment-documents/utility-communication/list"
  ) {
    try {
      const result = await db.query(`
        SELECT
          d.utility_communication_result_id,
          d.payment_document_ocr_import_id,
          d.specialist_analysis_id,
          d.result_no,
          d.result_version,
          d.customer_number,
          d.supply_point_number,
          d.meter_reading_date,
          d.usage_quantity,
          d.usage_unit,
          d.specialist_fields_json,
          d.visible_fields_json,
          d.warnings_json,
          d.created_at,
          d.updated_at,

          o.original_file_name,
          o.saved_file_name,

          s.analysis_system_code,
          s.analysis_system_label,
          s.ai_confidence,
          s.ai_reason,

          COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'utility_communication_line_item_id',
                  li.utility_communication_line_item_id,
                'line_no',
                  li.line_no,
                'item_name',
                  li.item_name,
                'description',
                  li.description,
                'usage_quantity',
                  li.usage_quantity,
                'usage_unit',
                  li.usage_unit,
                'unit_price',
                  li.unit_price,
                'subtotal_amount',
                  li.subtotal_amount,
                'tax_category_id',
                  li.tax_category_id,
                'tax_category_label',
                  tc.tax_name,
                'tax_rate',
                  li.tax_rate,
                'tax_amount',
                  li.tax_amount,
                'total_amount',
                  li.total_amount,
                'source_text',
                  li.source_text,
                'raw_item_json',
                  li.raw_item_json
              )
              ORDER BY
                li.line_no,
                li.utility_communication_line_item_id
            )
            FROM
              accounting.payment_document_utility_communication_line_items li
            LEFT JOIN
              expenses.tax_categories tc
              ON tc.tax_category_id = li.tax_category_id
            WHERE
              li.utility_communication_result_id =
                d.utility_communication_result_id
          ), '[]'::jsonb) AS line_items

        FROM
          accounting.payment_document_utility_communication_results d

        LEFT JOIN
          accounting.payment_document_ocr_imports o
          ON o.payment_document_ocr_import_id =
             d.payment_document_ocr_import_id

        LEFT JOIN
          accounting.payment_document_specialist_analysis_results s
          ON s.specialist_analysis_id =
             d.specialist_analysis_id

        WHERE
          d.is_current = TRUE
          AND d.deleted_at IS NULL

        ORDER BY
          d.created_at DESC,
          d.utility_communication_result_id DESC
      `);

      sendJson(res, 200, {
        ok: true,
        count: result.rowCount,
        rows: result.rows
      });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: err.message || String(err)
      });
    }

    return true;
  }
  /* HD_ORIGIN_UTILITY_LEDGER_GET_API_20260723_END */
/* HD_ORIGIN_CIL_LEDGER_GET_API_20260723_START */
    /* HD_ORIGIN_CIL_RETURN_TO_ANALYSIS_ROUTE_20260723_START */
  if (
    req.method === "POST" &&
    urlPath ===
      "/api/payment-documents/contract-insurance-lease/return-to-analysis"
  ) {
    try {
      const body = await readBody(req);

      const ocrImportId = Number(
        body.paymentDocumentOcrImportId ||
        body.payment_document_ocr_import_id ||
        body.ocrImportId ||
        body.id ||
        0
      );

      if (
        !Number.isInteger(ocrImportId) ||
        ocrImportId < 1
      ) {
        sendJson(res, 400, {
          ok: false,
          error: "OCR取込IDが不正です。"
        });

        return true;
      }

      const client = await db.connect();

      try {
        await client.query("BEGIN");

        /*
          台帳から解析一覧へ移動する。
          保存内容・専門解析結果・リース明細は削除しない。
        */
        const cilMoved = await client.query(
          `
            UPDATE
              accounting.payment_document_contract_insurance_lease_results
            SET
              result_status =
                'returned_to_analysis'
            WHERE
              payment_document_ocr_import_id = $1
              AND is_current = TRUE
              AND deleted_at IS NULL
            RETURNING
              contract_insurance_lease_result_id,
              payment_document_ocr_import_id,
              specialist_analysis_id
          `,
          [ocrImportId]
        );

        if (!cilMoved.rows.length) {
          await client.query("ROLLBACK");

          sendJson(res, 404, {
            ok: false,
            error:
              "台帳上の契約・保険・リース保存データが見つかりません。"
          });

          return true;
        }

        const movedRow =
          cilMoved.rows[0];

        let specialistResultCount = 0;

        if (
          movedRow.specialist_analysis_id
        ) {
          const specialistMoved =
            await client.query(
              `
                UPDATE
                  accounting.payment_document_specialist_analysis_results
                SET
                  specialist_analysis_status =
                    'returned_to_analysis'
                WHERE
                  specialist_analysis_id = $1
                RETURNING
                  specialist_analysis_id
              `,
              [
                movedRow
                  .specialist_analysis_id
              ]
            );

          specialistResultCount =
            specialistMoved.rowCount;
        }


        await client.query("COMMIT");

        sendJson(res, 200, {
          ok: true,

          paymentDocumentOcrImportId:
            ocrImportId,

          moveStatus:
            "returned_to_analysis",

          movedCilAnalysisCount:
            cilMoved.rowCount,

          movedSpecialistResultCount:
            specialistResultCount,

        });

        return true;
      }
      catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      finally {
        client.release();
      }
    }
    catch (error) {
      console.error(
        "contract-insurance-lease return-to-analysis failed:",
        error
      );

      sendJson(res, 500, {
        ok: false,
        error:
          error.message ||
          String(error)
      });

      return true;
    }
  }
  /* HD_ORIGIN_CIL_RETURN_TO_ANALYSIS_ROUTE_20260723_END */
  if (
    req.method === "GET" &&
    urlPath === "/api/payment-documents/contract-insurance-lease/list"
  ) {
    try {
      const result = await db.query(`
        SELECT
          d.contract_insurance_lease_result_id,
          d.payment_document_ocr_import_id,
          d.specialist_analysis_id,
          d.result_no,
          d.result_status,
          d.human_check_status,
          d.original_file_name,
          d.saved_file_name,
          d.document_type_code,
          d.document_type_label,
          d.contract_insurance_lease_kind_code,
          d.contract_insurance_lease_kind_label,
          d.lease_company_name,
          d.contractor_name,
          d.contract_start_date,
          d.contract_end_date,
          d.monthly_amount,
          d.currency,
          d.lease_item_name,
          d.monthly_lease_amount,
          d.ai_confidence,
          d.ai_reason,
          d.review_reason,
          d.specialist_fields_json,
          d.visible_fields_json,
          d.warnings_json,
          d.created_at,
          d.updated_at,
          COALESCE((
            SELECT jsonb_agg(
              to_jsonb(l)
              ORDER BY l.sort_order, l.lease_item_line_id
            )
            FROM accounting.payment_document_contract_insurance_lease_item_lines l
            WHERE l.contract_insurance_lease_result_id =
                  d.contract_insurance_lease_result_id
          ), '[]'::jsonb) AS lease_item_lines
        FROM accounting.payment_document_contract_insurance_lease_results d
        WHERE d.is_current = TRUE
          AND d.deleted_at IS NULL
          AND COALESCE(d.result_status, '') <> 'returned_to_analysis'
        ORDER BY
          d.contract_start_date DESC NULLS LAST,
          d.contract_insurance_lease_result_id DESC
      `);

      sendJson(res, 200, {
        ok: true,
        count: result.rowCount,
        rows: result.rows
      });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: err.message || String(err)
      });
    }

    return true;
  }
  /* HD_ORIGIN_CIL_LEDGER_GET_API_20260723_END */
    /* HD_ORIGIN_CIL_SAVED_RELOAD_API_20260724_START */
  if (
    req.method === "GET" &&
    urlPath.startsWith(
      "/api/payment-documents/contract-insurance-lease/saved/"
    )
  ) {
    try {
      const prefix =
        "/api/payment-documents/contract-insurance-lease/saved/";

      const idText =
        decodeURIComponent(
          urlPath.slice(prefix.length)
        );

      const ocrId =
        Number(idText);

      if (
        !Number.isInteger(ocrId) ||
        ocrId < 1
      ) {
        sendJson(res, 400, {
          ok: false,
          error: "不正なOCR取込IDです。"
        });

        return true;
      }

      const savedResult =
        await db.query(
          `
            SELECT
              d.*,

              r.analysis_system_code,
              r.analysis_system_label,
              r.specialist_analysis_status,

              r.ai_confidence
                AS specialist_ai_confidence,

              r.ai_reason
                AS specialist_ai_reason,

              r.warnings_json
                AS specialist_warnings_json,

              r.raw_result_json
                AS specialist_raw_result_json,

              COALESCE((
                SELECT
                  jsonb_agg(
                    to_jsonb(l)
                    ORDER BY
                      l.sort_order,
                      l.lease_item_line_id
                  )
                FROM
                  accounting.payment_document_contract_insurance_lease_item_lines l
                WHERE
                  l.contract_insurance_lease_result_id =
                    d.contract_insurance_lease_result_id
              ), '[]'::jsonb)
                AS lease_item_lines

            FROM
              accounting.payment_document_contract_insurance_lease_results d

            LEFT JOIN
              accounting.payment_document_specialist_analysis_results r
              ON r.specialist_analysis_id =
                 d.specialist_analysis_id

            WHERE
              d.payment_document_ocr_import_id = $1
              AND d.is_current = TRUE
              AND d.deleted_at IS NULL

            ORDER BY
              d.updated_at DESC NULLS LAST,
              d.contract_insurance_lease_result_id DESC

            LIMIT 1
          `,
          [ocrId]
        );

      if (!savedResult.rows.length) {
        sendJson(res, 404, {
          ok: false,
          error:
            "保存済み契約・保険・リースデータが見つかりません。"
        });

        return true;
      }

      sendJson(res, 200, {
        ok: true,
        paymentDocumentOcrImportId: ocrId,
        saved: savedResult.rows[0]
      });
    }
    catch (error) {
      console.error(
        "contract-insurance-lease saved reload failed:",
        error
      );

      sendJson(res, 500, {
        ok: false,
        error:
          error && error.message
            ? error.message
            : String(error)
      });
    }

    return true;
  }
  /* HD_ORIGIN_CIL_SAVED_RELOAD_API_20260724_END */
/* GPT3_UTILITY_SAVED_RELOAD_API_START */
  if (
    req.method === "GET" &&
    urlPath.startsWith(
      "/api/payment-documents/utility-communication/saved/"
    )
  ) {
    try {
      const prefix =
        "/api/payment-documents/utility-communication/saved/";

      const idText =
        decodeURIComponent(
          urlPath.slice(prefix.length)
        );

      const ocrId =
        Number(idText);

      if (
        !Number.isInteger(ocrId) ||
        ocrId < 1
      ) {
        sendJson(res, 400, {
          ok: false,
          error: "不正なOCR取込IDです。"
        });

        return true;
      }

      const savedResult =
        await db.query(
          `
            SELECT
              d.utility_communication_result_id,
              d.payment_document_ocr_import_id,
              d.specialist_analysis_id,
              d.result_no,
              d.result_version,

              d.customer_number,
              d.supply_point_number,
              d.meter_reading_date,
              d.usage_quantity,
              d.usage_unit,

              d.specialist_fields_json,
              d.ai_raw_json,
              d.visible_fields_json,
              d.warnings_json
                AS utility_warnings_json,

              r.analysis_system_code,
              r.analysis_system_label,
              r.ai_confidence,
              r.ai_reason,
              r.warnings_json
                AS specialist_warnings_json,
              r.raw_result_json

            FROM
              accounting.payment_document_utility_communication_results d

            LEFT JOIN
              accounting.payment_document_specialist_analysis_results r
              ON r.specialist_analysis_id =
                 d.specialist_analysis_id

            WHERE
              d.payment_document_ocr_import_id = $1
              AND d.is_current = TRUE
              AND d.deleted_at IS NULL

            ORDER BY
              d.result_version DESC,
              d.utility_communication_result_id DESC

            LIMIT 1
          `,
          [ocrId]
        );

      if (!savedResult.rows.length) {
        sendJson(res, 404, {
          ok: false,
          error:
            "保存済み公共料金・通信費データがありません。",
          paymentDocumentOcrImportId:
            ocrId
        });

        return true;
      }

      const lineResult =
        await db.query(
          `
            SELECT
              utility_communication_line_item_id,
              utility_communication_result_id,
              line_no,
              item_name,
              description,
              usage_quantity,
              usage_unit,
              unit_price,
              subtotal_amount,
              tax_rate,
              tax_category_id,
              tax_amount,
              total_amount,
              source_text,
              raw_item_json

            FROM
              accounting.payment_document_utility_communication_line_items

            WHERE
              utility_communication_result_id = $1

            ORDER BY
              line_no,
              utility_communication_line_item_id
          `,
          [
            savedResult.rows[0]
              .utility_communication_result_id
          ]
        );

      const row =
        savedResult.rows[0];

      const objectOrEmpty =
        value =>
          value &&
          typeof value === "object" &&
          !Array.isArray(value)
            ? value
            : {};

      const rawResult =
        objectOrEmpty(
          row.raw_result_json
        );

      const rawSpecialist =
        objectOrEmpty(
          rawResult.specialist
        );

      const savedAnalysis =
        Object.keys(
          objectOrEmpty(rawResult.analysis)
        ).length
          ? objectOrEmpty(rawResult.analysis)
          : objectOrEmpty(
              rawSpecialist.analysis
            );

      const specialistFields =
        objectOrEmpty(
          row.specialist_fields_json
        );

      const lineItems =
        lineResult.rows.map(row => {
          const rawItem =
            row.raw_item_json &&
            typeof row.raw_item_json === "object" &&
            !Array.isArray(row.raw_item_json)
              ? row.raw_item_json
              : {};

          return {
            ...row,

            tax_category_label:
              rawItem.tax_category_label ||
              ""
          };
        });

      const fields = {
        ...objectOrEmpty(savedAnalysis.fields),
        ...specialistFields,
        line_items:
          lineItems
      };

      const visibleFieldLabels =
        Array.isArray(
          rawResult.visible_field_labels
        )
          ? rawResult.visible_field_labels
          : Array.isArray(
              rawSpecialist.visible_field_labels
            )
            ? rawSpecialist.visible_field_labels
            : Array.isArray(
                savedAnalysis.visible_field_labels
              )
              ? savedAnalysis.visible_field_labels
              : [];

      const warnings =
        Array.isArray(
          row.specialist_warnings_json
        )
          ? row.specialist_warnings_json
          : Array.isArray(savedAnalysis.warnings)
            ? savedAnalysis.warnings
            : Array.isArray(
                row.utility_warnings_json
              )
              ? row.utility_warnings_json
              : [];

      const draft = {
        ...savedAnalysis,

        analysis_system_code:
          row.analysis_system_code ||
          savedAnalysis.analysis_system_code ||
          "",

        analysis_system_label:
          row.analysis_system_label ||
          savedAnalysis.analysis_system_label ||
          "",

        analysis_system_reason:
          row.ai_reason ||
          savedAnalysis.analysis_system_reason ||
          "",

        analysis_system_confidence:
          row.ai_confidence ||
          savedAnalysis.analysis_system_confidence ||
          "",

        fields,
        specialist_fields:
          fields,

        line_items:
          lineItems,

        visible_field_labels:
          visibleFieldLabels,

        warnings
      };

      sendJson(res, 200, {
        ok: true,

        paymentDocumentOcrImportId:
          row.payment_document_ocr_import_id,


        specialistAnalysisId:
          row.specialist_analysis_id,

        analysisVersion:
          row.result_version,

        draft,
        visible_field_labels:
          visibleFieldLabels,
        warnings,

        line_items:
          lineItems,

        source:
          "saved_utility_communication_database",

        ai_execution:
          false
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error:
          error.message ||
          String(error)
      });
    }

    return true;
  }
  /* GPT3_UTILITY_SAVED_RELOAD_API_END */
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
          analysisSystemCode: "invoice_payable",
          analysisSystemLabel: "請求・未払系専門解析システム"
        },
        tax_public: {
          routeLabel: "税金・公的支払解析",
          analysisSystemCode: "tax_public",
          analysisSystemLabel: "税金・公的支払専門解析システム"
        },
        utility_communication: {
          routeLabel: "公共料金・通信費解析",
          analysisSystemCode: "utility_communication",
          analysisSystemLabel: "公共料金・通信費専門解析システム"
        },
        contract_insurance_lease: {
          routeLabel: "契約・保険・リース解析",
          analysisSystemCode: "contract_insurance_lease",
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
        await createPaymentDocumentSpecialistAnalysisFromOcrText(
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
            analysis:
              body.analysis ||
              body.classification ||
              {}
          }
        );

      const specialistSaved = await hdOriginSavePaymentDocumentSpecialistAnalysisResult({
        ...body,
        paymentDocumentOcrImportId: id,
        payment_document_ocr_import_id: id,
        analysis: aiResult.analysis,
        classification: aiResult.classification,
        specialistResult: aiResult.specialist,
        rawResult: {
          analysis: aiResult.analysis,
          classification: aiResult.classification,
          specialist: aiResult.specialist
        },
        visibleFieldLabels: aiResult.visible_field_labels,
        warnings: aiResult.analysis.warnings || []
      });

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
        analysis: aiResult.analysis,
        specialistAnalysisId: specialistSaved.specialistAnalysisId,
        specialist_analysis_id: specialistSaved.specialistAnalysisId
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
      const originalFileName = String(
        body.originalFileName ||
        body.fileName ||
        "payment-document"
      ).trim();
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
      const duplicateItem = await findDuplicatePaymentDocument(
        fileHash,
        parsed.buffer.length
      );

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
        rawSourceRelativePath:
          body.originalRelativePath ||
          body.originalFileName ||
          originalFileName,
        rawSourceOriginalFileName: originalFileName,
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

  if (req.method === "POST" && urlPath === "/api/payment-documents/scan-inbox/reset-ocr") {
    try {
      const body = await readBody(req);
      const fileName = path.basename(String(body.fileName || ""));

      if (!fileName) {
        throw new Error("ファイル名がありません。");
      }

      const inboxPath = filePathFromName(fileName);
      let sourcePath = inboxPath;
      let restoredFromSaved = false;

      if (!fs.existsSync(sourcePath)) {
        const savedRelativePath =
          String(body.savedRelativePath || "").trim();

        if (!savedRelativePath) {
          throw new Error(
            "INBOXに対象がなく、SAVED保存先も指定されていません。"
          );
        }

        sourcePath =
          safePaymentDocumentFilePathFromRelative(
            savedRelativePath
          );

        if (
          !sourcePath ||
          !fs.existsSync(sourcePath) ||
          !fs.statSync(sourcePath).isFile()
        ) {
          throw new Error("SAVEDに対象ファイルが見つかりません。");
        }
      }

      const sourceMetaPath = metaPathFor(sourcePath);
      const current = readJsonSafe(sourceMetaPath) || {};

      let targetPath = sourcePath;
      let targetMetaPath = sourceMetaPath;

      if (path.resolve(sourcePath) !== path.resolve(inboxPath)) {
        targetPath = uniqueFilePath(
          scanInboxDir(),
          path.basename(sourcePath)
        );

        targetMetaPath = metaPathFor(targetPath);

        fs.renameSync(sourcePath, targetPath);

        if (fs.existsSync(sourceMetaPath)) {
          fs.renameSync(sourceMetaPath, targetMetaPath);
        }

        restoredFromSaved = true;
      }

      writeJson(targetMetaPath, {
        ...current,
        fileName: path.basename(targetPath),
        savedFileName: path.basename(targetPath),

        processStatus: "inbox",
        ocrStatus: "ocr_waiting",

        ocrProvider: "",
        ocrApiVersion: "",
        ocrAt: "",
        ocrRawText: "",
        ocr_raw_text: "",
        ocrText: "",
        ocrTextLength: 0,
        ocrError: "",

        savedRelativePath: "",
        savedMetaRelativePath: "",
        savedAt: "",

        dbSaved: false,
        paymentDocumentOcrImportId: null,
        updatedAt: new Date().toISOString()
      });

      sendJson(res, 200, {
        ok: true,
        fileName: path.basename(targetPath),
        restoredFromSaved,
        processStatus: "inbox",
        ocrStatus: "ocr_waiting"
      });
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: err.message
      });
    }

    return true;
  }
  if (req.method === "POST" && urlPath === "/api/payment-documents/scan-inbox/delete") {
    try {
      const body = await readBody(req);
      const filePath = filePathFromName(body.fileName);

      if (!fs.existsSync(filePath)) {
        throw new Error("INBOXファイルが見つかりません。");
      }

      const metaPath = metaPathFor(filePath);
      const meta = readJsonSafe(metaPath) || {};

      const rawRestore =
        moveRawReceiptBackToPending(meta);

      if (!rawRestore.moved) {
        throw new Error(
          rawRestore.error ||
          "済OCRから未OCRへの原本移動に失敗しました。"
        );
      }

      try {
        fs.unlinkSync(filePath);

        if (fs.existsSync(metaPath)) {
          fs.unlinkSync(metaPath);
        }
      } catch (deleteError) {
        try {
          moveFileAllowCrossDevice(
            rawRestore.destinationPath,
            rawRestore.sourcePath
          );
        } catch (_) {
        }

        throw new Error(
          "INBOX削除に失敗したため、原本移動を取り消しました: " +
          (deleteError.message || String(deleteError))
        );
      }

      sendJson(res, 200, {
        ok: true,
        message:
          "原本を済OCRから未OCRへ戻し、INBOXから削除しました。",
        rawSourcePath: rawRestore.sourcePath,
        rawPendingPath: rawRestore.destinationPath
      });
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: err.message
      });
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
