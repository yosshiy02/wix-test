const fs = require("fs");
const path = require("path");
const config = require("../config");
const { sendJson } = require("../response");

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const AZURE_API_VERSION = "2024-11-30";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function inboxDir() {
  const dir = path.join(config.projectRoot, "storage", "payment-documents", "scan-inbox");
  ensureDir(dir);
  return dir;
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
        updatedAt: stat.mtime.toISOString(),
        inboxStatus: meta.inboxStatus || "",
        processStatus: meta.processStatus || "",
        ocrStatus: meta.ocrStatus || (ocrText ? "ocr_done" : "ocr_waiting"),
        ocrProvider: meta.ocrProvider || "",
        ocrAt: meta.ocrAt || "",
        ocrError: meta.ocrError || "",
        ocrRawText: ocrText,
        ocrTextPreview: String(ocrText).slice(0, 240)
      };
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

async function handlePaymentDocumentRoutes(req, res) {
  const urlObj = new URL(req.url, "http://localhost");
  const urlPath = urlObj.pathname;

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

      const saveName = timestampPrefix() + "_" + safeOriginal;
      const filePath = path.join(inboxDir(), saveName);

      fs.writeFileSync(filePath, parsed.buffer);

      writeJson(metaPathFor(filePath), {
        originalFileName,
        savedFileName: saveName,
        mimeType: body.mimeType || parsed.mimeType,
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

// PAYMENT_DOCUMENT_PREVIEW_ROTATION_API_20260707_START
const __pdRotationFs = require("fs");
const __pdRotationFsp = __pdRotationFs.promises;
const __pdRotationPath = require("path");

function __pdRotationNormalize(value) {
  const n = Number(value) || 0;
  return ((n % 360) + 360) % 360;
}

function __pdRotationSafeFileName(fileName) {
  const name = String(fileName || "");

  if (!name) {
    return "";
  }

  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    return "";
  }

  return name;
}

function __pdRotationScanInboxDir() {
  if (typeof SCAN_INBOX_DIR !== "undefined" && SCAN_INBOX_DIR) {
    return SCAN_INBOX_DIR;
  }

  if (typeof scanInboxDir !== "undefined" && scanInboxDir) {
    return scanInboxDir;
  }

  if (typeof PAYMENT_DOCUMENT_SCAN_INBOX_DIR !== "undefined" && PAYMENT_DOCUMENT_SCAN_INBOX_DIR) {
    return PAYMENT_DOCUMENT_SCAN_INBOX_DIR;
  }

  return __pdRotationPath.resolve(__dirname, "..", "..", "..", "storage", "payment-documents", "scan-inbox");
}

async function __pdRotationReadMeta(metaPath) {
  try {
    const text = await __pdRotationFsp.readFile(metaPath, "utf8");
    return JSON.parse(text || "{}");
  } catch (error) {
    return {};
  }
}

async function __pdRotationWriteMeta(metaPath, meta) {
  await __pdRotationFsp.mkdir(__pdRotationPath.dirname(metaPath), { recursive: true });
  await __pdRotationFsp.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
}

router.get("/scan-inbox/preview-rotation/:fileName", async (req, res) => {
  try {
    const fileName = __pdRotationSafeFileName(req.params.fileName);

    if (!fileName) {
      return res.status(400).json({ ok: false, error: "fileName が不正です。" });
    }

    const filePath = __pdRotationPath.join(__pdRotationScanInboxDir(), fileName);
    const metaPath = filePath + ".meta.json";

    const meta = await __pdRotationReadMeta(metaPath);
    const previewRotation = __pdRotationNormalize(meta.previewRotation ?? meta.rotation ?? 0);

    return res.json({
      ok: true,
      fileName,
      previewRotation
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
});

router.post("/scan-inbox/save-preview-rotation", async (req, res) => {
  try {
    const fileName = __pdRotationSafeFileName(req.body && req.body.fileName);
    const previewRotation = __pdRotationNormalize(req.body && req.body.previewRotation);

    if (!fileName) {
      return res.status(400).json({ ok: false, error: "fileName が不正です。" });
    }

    const filePath = __pdRotationPath.join(__pdRotationScanInboxDir(), fileName);

    if (!__pdRotationFs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: "対象ファイルが見つかりません。" });
    }

    const metaPath = filePath + ".meta.json";
    const meta = await __pdRotationReadMeta(metaPath);

    meta.previewRotation = previewRotation;
    meta.rotation = previewRotation;
    meta.previewRotationUpdatedAt = new Date().toISOString();

    await __pdRotationWriteMeta(metaPath, meta);

    return res.json({
      ok: true,
      fileName,
      previewRotation
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || String(error)
    });
  }
});
// PAYMENT_DOCUMENT_PREVIEW_ROTATION_API_20260707_END

module.exports = {
  handlePaymentDocumentRoutes
};