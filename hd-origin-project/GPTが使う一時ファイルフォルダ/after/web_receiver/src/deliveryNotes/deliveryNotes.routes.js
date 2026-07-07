const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");
const { sendJson } = require("../response");
const repo = require("./deliveryNotes.repository");

function getUrl(req) {
  return new URL(req.url, `http://${req.headers.host || "localhost"}`);
}

function getPathname(req) {
  return getUrl(req).pathname.replace(/\/+$/, "") || "/";
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 30 * 1024 * 1024) {
        reject(new Error("本文が大きすぎます。30MB以内にしてください。"));
      }
    });

    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("JSONの解析に失敗しました: " + error.message));
      }
    });

    req.on("error", reject);
  });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function getImageContentType(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".bmp") return "image/bmp";
  if (ext === ".pdf") return "application/pdf";
  return "image/jpeg";
}

function isDeliveryNoteFile(fileName) {
  const ext = path.extname(fileName || "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".pdf"].includes(ext);
}

function extensionFromMimeType(mimeType, fallbackFileName) {
  const fallbackExt = path.extname(fallbackFileName || "").toLowerCase();
  if (fallbackExt) return fallbackExt;
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/bmp") return ".bmp";
  if (mimeType === "application/pdf") return ".pdf";
  return ".jpg";
}

function parseDataUrlFile(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([a-zA-Z0-9/_.+-]+);base64,([\s\S]+)$/);
  if (!match) {
    throw new Error("DataURL形式ではありません。");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

function getDeliveryNoteRoot() {
  if (config.deliveryNoteRoot) {
    return path.resolve(config.deliveryNoteRoot);
  }

  const rootFromEnv = process.env.HD_ORIGIN_DELIVERY_NOTE_ROOT || process.env.DELIVERY_NOTE_ROOT || "";
  if (rootFromEnv) {
    return path.isAbsolute(rootFromEnv)
      ? path.resolve(rootFromEnv)
      : path.resolve(config.projectRoot, rootFromEnv);
  }

  const hddbtestRoot = process.env.HDDBTEST_ROOT || "";
  if (hddbtestRoot) {
    return path.resolve(hddbtestRoot, "HDDB_PROJECT", "ORIGIN", "delivery-notes");
  }

  return path.resolve(config.projectRoot, "ORIGIN会計ソフト", "納品書関係");
}

function getScanInboxDir() {
  const fromEnv = process.env.DELIVERY_NOTE_SCAN_INBOX || "";
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? path.resolve(fromEnv)
      : path.resolve(getDeliveryNoteRoot(), fromEnv);
  }

  return path.resolve(getDeliveryNoteRoot(), "scan_inbox");
}

function getImportedImageDir() {
  return path.resolve(getDeliveryNoteRoot(), "images");
}

function safeBaseName(fileName) {
  return path.basename(String(fileName || "").replace(/[\\/:*?"<>|]/g, "_"));
}

function listScanInboxFiles() {
  const dir = getScanInboxDir();

  if (!fs.existsSync(dir)) {
    return {
      dir,
      missing: true,
      files: []
    };
  }

  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => isDeliveryNoteFile(entry.name))
    .map((entry) => {
      const fullPath = path.join(dir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        fileName: entry.name,
        fullPath,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime,
        mimeType: getImageContentType(fullPath),
        sha256: sha256File(fullPath)
      };
    })
    .sort((a, b) => String(a.fileName).localeCompare(String(b.fileName), "ja"));

  return {
    dir,
    missing: false,
    files
  };
}

function copyScanFileToImported(fileName) {
  const safeName = safeBaseName(fileName);
  if (!safeName) {
    throw new Error("fileName が空です。");
  }

  const scanDir = getScanInboxDir();
  const src = path.resolve(scanDir, safeName);

  if (!src.startsWith(path.resolve(scanDir))) {
    throw new Error("不正なファイル名です。");
  }

  if (!fs.existsSync(src)) {
    throw new Error("取込元ファイルが見つかりません: " + safeName);
  }

  if (!isDeliveryNoteFile(safeName)) {
    throw new Error("納品書として扱えない拡張子です: " + safeName);
  }

  const importedDir = getImportedImageDir();
  ensureDir(importedDir);

  const ext = path.extname(safeName).toLowerCase() || ".jpg";
  const base = path.basename(safeName, ext).replace(/[^\w\u3040-\u30ff\u3400-\u9fff.-]+/g, "_");
  const stamped = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const dstName = `delivery_note_${stamped}_${base}${ext}`;
  const dst = path.join(importedDir, dstName);

  fs.copyFileSync(src, dst);

  const stat = fs.statSync(dst);

  return {
    local_image_file_name: dstName,
    local_image_path: dst,
    original_file_name: safeName,
    image_hash_sha256: sha256File(dst),
    image_size_bytes: stat.size,
    mime_type: getImageContentType(dst),
    source_type: "scan_inbox"
  };
}

function saveUploadedFile(payload) {
  const parsed = parseDataUrlFile(payload.dataUrl || payload.fileDataUrl || "");
  const originalName = safeBaseName(payload.fileName || "delivery-note.jpg");
  const ext = extensionFromMimeType(parsed.mimeType, originalName);

  if (!isDeliveryNoteFile(originalName || ("x" + ext))) {
    throw new Error("納品書として扱えない拡張子です。");
  }

  const importedDir = getImportedImageDir();
  ensureDir(importedDir);

  const stamped = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const base = path.basename(originalName, path.extname(originalName)).replace(/[^\w\u3040-\u30ff\u3400-\u9fff.-]+/g, "_") || "upload";
  const dstName = `delivery_note_${stamped}_${base}${ext}`;
  const dst = path.join(importedDir, dstName);

  fs.writeFileSync(dst, parsed.buffer);

  return {
    local_image_file_name: dstName,
    local_image_path: dst,
    original_file_name: originalName,
    image_hash_sha256: sha256Buffer(parsed.buffer),
    image_size_bytes: parsed.buffer.length,
    mime_type: parsed.mimeType,
    source_type: "manual_upload"
  };
}

function extractBasicCandidateFromOcr(text) {
  const raw = String(text || "");
  const compact = raw.replace(/\r/g, "");
  const lines = compact.split(/\n+/).map((x) => x.trim()).filter(Boolean);

  const dateMatch =
    compact.match(/(20\d{2})[\/\-.年]\s*(\d{1,2})[\/\-.月]\s*(\d{1,2})/) ||
    compact.match(/(\d{4})(\d{2})(\d{2})/);

  let deliveryDate = "";
  if (dateMatch) {
    const y = dateMatch[1];
    const m = String(dateMatch[2]).padStart(2, "0");
    const d = String(dateMatch[3]).padStart(2, "0");
    deliveryDate = `${y}-${m}-${d}`;
  }

  const noteNoMatch =
    compact.match(/(?:納品書番号|納品番号|伝票番号|No\.?|NO\.?)\s*[:：]?\s*([A-Za-z0-9\-_.]+)/i);

  const amountMatches = [...compact.matchAll(/(?:合計|税込|請求金額|総合計)[^\d¥￥]*[¥￥]?\s*([0-9,]+)(?:円)?/g)]
    .map((m) => Number(String(m[1]).replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));

  const totalAmount = amountMatches.length ? amountMatches[amountMatches.length - 1] : null;

  return {
    deliveryDate,
    vendorName: lines[0] || "",
    deliveryNoteNo: noteNoMatch ? noteNoMatch[1] : "",
    totalAmount,
    subtotalAmount: null,
    taxAmount: null,
    totalQuantity: null,
    summary: "OCR本文から作成した仮候補です。人間確認してください。",
    lines: []
  };
}


/* DELIVERY_NOTE_AZURE_OCR_20260707_START */
function deliveryNoteSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deliveryNoteCountOcrLines(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return 0;

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function deliveryNoteCountOcrWords(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return 0;

  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;
}

function deliveryNoteExtractOcrRawText(result) {
  if (result && result.analyzeResult && result.analyzeResult.content) {
    return String(result.analyzeResult.content || "");
  }

  const pages = result && result.analyzeResult && result.analyzeResult.pages
    ? result.analyzeResult.pages
    : [];

  const lines = [];

  for (const page of pages) {
    for (const line of page.lines || []) {
      if (line.content) {
        lines.push(line.content);
      }
    }
  }

  return lines.join("\n");
}

function deliveryNoteReadEnvFileValues() {
  const values = {};
  const candidates = [];

  if (process.env.HD_ORIGIN_ENV_PATH) {
    candidates.push(process.env.HD_ORIGIN_ENV_PATH);
  }

  const projectRoot = config.projectRoot || path.resolve(__dirname, "../../..");
  const envPathFile = path.resolve(projectRoot, ".env_path.txt");

  if (fs.existsSync(envPathFile)) {
    const p = fs.readFileSync(envPathFile, "utf8").trim();
    if (p) {
      candidates.push(p);
    }
  }

  candidates.push(path.resolve(projectRoot, ".env"));

  for (const filePath of candidates) {
    if (!filePath || !fs.existsSync(filePath)) {
      continue;
    }

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = String(line || "").trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const eq = trimmed.indexOf("=");

      if (eq < 0) {
        continue;
      }

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();

      value = value.replace(/^["']|["']$/g, "");

      if (key && values[key] === undefined) {
        values[key] = value;
      }
    }
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value !== "") {
      values[key] = value;
    }
  }

  return values;
}

function deliveryNoteGetEnvValue(name) {
  const fromProcess = process.env[name];

  if (fromProcess) {
    return fromProcess;
  }

  const values = deliveryNoteReadEnvFileValues();
  return values[name] || "";
}

async function deliveryNoteRunAzureReadOcrForFile(filePath) {
  const endpoint = deliveryNoteGetEnvValue("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT").replace(/\/+$/, "");
  const key = deliveryNoteGetEnvValue("AZURE_DOCUMENT_INTELLIGENCE_KEY");

  if (!endpoint) {
    throw new Error("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT is missing");
  }

  if (!key) {
    throw new Error("AZURE_DOCUMENT_INTELLIGENCE_KEY is missing");
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("OCR対象ファイルが見つかりません。");
  }

  const apiVersion = deliveryNoteGetEnvValue("AZURE_DOCUMENT_INTELLIGENCE_API_VERSION") || "2024-11-30";
  const url = endpoint + "/documentintelligence/documentModels/prebuilt-read:analyze?api-version=" + encodeURIComponent(apiVersion);

  const startRes = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": getImageContentType(filePath),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0"
    },
    body: fs.readFileSync(filePath)
  });

  if (startRes.status !== 202) {
    const body = await startRes.text();
    throw new Error("Azure OCR開始エラー status=" + startRes.status + " body=" + body);
  }

  const operationLocation = startRes.headers.get("operation-location");

  if (!operationLocation) {
    throw new Error("Azure OCR operation-location がありません。");
  }

  let result = null;

  for (let i = 0; i < 40; i += 1) {
    await deliveryNoteSleep(1000);

    const pollRes = await fetch(operationLocation, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": key
      }
    });

    const json = await pollRes.json();

    if (!pollRes.ok) {
      throw new Error("Azure OCR確認エラー status=" + pollRes.status + " body=" + JSON.stringify(json));
    }

    if (json.status === "succeeded") {
      result = json;
      break;
    }

    if (json.status === "failed") {
      throw new Error("Azure OCR failed: " + JSON.stringify(json.error || json));
    }
  }

  if (!result) {
    throw new Error("Azure OCRタイムアウト");
  }

  const rawText = deliveryNoteExtractOcrRawText(result);

  return {
    provider: "azure-document-intelligence-read",
    rawText,
    lineCount: deliveryNoteCountOcrLines(rawText),
    wordCount: deliveryNoteCountOcrWords(rawText)
  };
}

async function deliveryNoteRunAzureOcrForImport(importId) {
  const id = Number(importId);

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("納品書取込IDが不正です。");
  }

  const item = await repo.getImportById(id);

  if (!item) {
    throw new Error("納品書取込データが見つかりません。ID=" + id);
  }

  if (!item.local_image_path || !fs.existsSync(item.local_image_path)) {
    throw new Error("納品書画像ファイルが見つかりません。ID=" + id);
  }

  const ocr = await deliveryNoteRunAzureReadOcrForFile(item.local_image_path);
  const updated = await repo.updateImportOcrRawText(id, ocr.rawText);

  return {
    ok: true,
    import_id: id,
    provider: ocr.provider,
    rawText: ocr.rawText,
    lineCount: ocr.lineCount,
    wordCount: ocr.wordCount,
    item: updated
  };
}
/* DELIVERY_NOTE_AZURE_OCR_20260707_END */
async function handleDeliveryNoteRoutes(req, res) {
  const pathname = getPathname(req);
  const url = getUrl(req);

  if (req.method === "GET" && pathname === "/api/delivery-notes/scan-inbox") {
    const result = listScanInboxFiles();
    sendJson(res, 200, { ok: true, ...result });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/delivery-notes/imports") {
    const items = await repo.listImports({
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset")
    });
    sendJson(res, 200, { ok: true, items });
    return true;
  }

  let match = pathname.match(/^\/api\/delivery-notes\/imports\/(\d+)$/);
  if (req.method === "GET" && match) {
    const item = await repo.getImportById(Number(match[1]));
    if (!item) {
      sendJson(res, 404, { ok: false, error: "納品書取込データが見つかりません。" });
      return true;
    }
    sendJson(res, 200, { ok: true, item });
    return true;
  }

  match = pathname.match(/^\/api\/delivery-notes\/image\/(\d+)$/);
  if (req.method === "GET" && match) {
    const item = await repo.getImportById(Number(match[1]));
    if (!item || !item.local_image_path || !fs.existsSync(item.local_image_path)) {
      sendJson(res, 404, { ok: false, error: "納品書画像が見つかりません。" });
      return true;
    }

    res.writeHead(200, {
      "Content-Type": item.mime_type || getImageContentType(item.local_image_path),
      "Cache-Control": "no-store"
    });
    fs.createReadStream(item.local_image_path).pipe(res);
    return true;
  }

  if (req.method === "POST" && pathname === "/api/delivery-notes/import-scan") {
    const body = await readJsonBody(req);
    const fileRecord = copyScanFileToImported(body.fileName);
    const item = await repo.createImport(fileRecord);
    sendJson(res, 200, { ok: true, item });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/delivery-notes/upload") {
    const body = await readJsonBody(req);
    const fileRecord = saveUploadedFile(body);
    const item = await repo.createImport(fileRecord);
    sendJson(res, 200, { ok: true, item });
    return true;
  }

  match = pathname.match(/^\/api\/delivery-notes\/imports\/(\d+)\/ocr$/);
  if (req.method === "POST" && match) {
    const body = await readJsonBody(req);
    const item = await repo.updateImportOcrRawText(Number(match[1]), body.ocrRawText || body.ocr_raw_text || "");
    sendJson(res, 200, { ok: true, item });
    return true;
  }

  match = pathname.match(/^\/api\/delivery-notes\/analyze\/(\d+)$/);
  if (req.method === "POST" && match) {
    const importId = Number(match[1]);
    const body = await readJsonBody(req);
    const ocrRawText = body.ocrRawText || body.ocr_raw_text || "";
    await repo.updateImportOcrRawText(importId, ocrRawText);

    const candidate = extractBasicCandidateFromOcr(ocrRawText);
    await repo.updateImportAiResult(importId, candidate);

    sendJson(res, 200, {
      ok: true,
      candidate,
      note: "現段階はOCR本文からの仮候補です。画像AIではありません。"
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/delivery-notes/drafts") {
    const body = await readJsonBody(req);
    const draft = await repo.saveDraft(body);
    sendJson(res, 200, { ok: true, draft });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/delivery-notes/drafts") {
    const importId = Number(url.searchParams.get("import_id") || url.searchParams.get("importId") || 0);
    if (!importId) {
      sendJson(res, 400, { ok: false, error: "import_id が必要です。" });
      return true;
    }

    const draft = await repo.getDraftByImportId(importId);
    sendJson(res, 200, { ok: true, draft });
    return true;
  }


  /* DELIVERY_NOTE_AZURE_OCR_ROUTES_20260707_START */
  match = pathname.match(/^\/api\/delivery-notes\/imports\/(\d+)\/ocr-azure$/);
  if (req.method === "POST" && match) {
    try {
      const result = await deliveryNoteRunAzureOcrForImport(Number(match[1]));

      sendJson(res, 200, {
        ok: true,
        message: "Azure OCRが完了しました。",
        result
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || String(error)
      });
    }

    return true;
  }

  if (req.method === "POST" && pathname === "/api/delivery-notes/imports/bulk-ocr") {
    try {
      const body = await readJsonBody(req);
      const rawIds = Array.isArray(body.deliveryNoteImportIds)
        ? body.deliveryNoteImportIds
        : Array.isArray(body.delivery_note_import_ids)
          ? body.delivery_note_import_ids
          : Array.isArray(body.ids)
            ? body.ids
            : [];

      const ids = Array.from(new Set(
        rawIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ));

      if (!ids.length) {
        sendJson(res, 400, {
          ok: false,
          error: "OCRする納品書が選択されていません。"
        });

        return true;
      }

      const results = [];
      let success = 0;
      let failed = 0;

      for (const id of ids) {
        try {
          const result = await deliveryNoteRunAzureOcrForImport(id);
          success += 1;
          results.push({
            ok: true,
            import_id: id,
            lineCount: result.lineCount,
            wordCount: result.wordCount
          });
        } catch (error) {
          failed += 1;
          results.push({
            ok: false,
            import_id: id,
            error: error.message || String(error)
          });
        }
      }

      sendJson(res, 200, {
        ok: failed === 0,
        message: "まとめてAzure OCRが完了しました。",
        summary: {
          total: ids.length,
          success,
          failed
        },
        results
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || String(error)
      });
    }

    return true;
  }
  /* DELIVERY_NOTE_AZURE_OCR_ROUTES_20260707_END */
  return false;
}

module.exports = {
  handleDeliveryNoteRoutes
};