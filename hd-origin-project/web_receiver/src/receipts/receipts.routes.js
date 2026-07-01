const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { sendJson } = require("../response");
const repo = require("./receipts.repository");
const ai = require("./receipts.ai");

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(text);
}

function getUrl(req) {
  return new URL(req.url, `http://${req.headers.host || "localhost"}`);
}

function getPathname(req) {
  return getUrl(req).pathname;
}

function getSearchParam(req, name) {
  return getUrl(req).searchParams.get(name);
}

function getImageContentType(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();

  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";

  return "image/jpeg";
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error("本文が大きすぎます。"));
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


function getProjectRoot() {
  return path.resolve(__dirname, "..", "..", "..");
}

function getReceiptScanInboxDir() {
  if (process.env.RECEIPT_SCAN_INBOX) {
    return path.resolve(getProjectRoot(), process.env.RECEIPT_SCAN_INBOX);
  }

  return path.resolve(
    getProjectRoot(),
    "ORIGIN会計ソフト",
    "レシート関係",
    "scan_inbox"
  );
}

function isReceiptImageFile(fileName) {
  const ext = path.extname(fileName || "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"].includes(ext);
}

function sha256File(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function listReceiptScanInboxFiles() {
  const dir = getReceiptScanInboxDir();

  if (!fs.existsSync(dir)) {
    return {
      dir,
      files: [],
      missing: true,
    };
  }

  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => isReceiptImageFile(entry.name))
    .map((entry) => {
      const fullPath = path.join(dir, entry.name);
      const stat = fs.statSync(fullPath);

      return {
        fileName: entry.name,
        fullPath,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime,
        sha256: sha256File(fullPath),
      };
    })
    .sort((a, b) => String(a.fileName).localeCompare(String(b.fileName), "ja"));

  return {
    dir,
    files,
    missing: false,
  };
}


function readEnvFileValues() {
  const values = {};

  const candidates = [];

  if (process.env.HD_ORIGIN_ENV_PATH) {
    candidates.push(process.env.HD_ORIGIN_ENV_PATH);
  }

  const envPathFile = path.resolve(getProjectRoot(), ".env_path.txt");
  if (fs.existsSync(envPathFile)) {
    const p = fs.readFileSync(envPathFile, "utf8").trim();
    if (p) candidates.push(p);
  }

  candidates.push(path.resolve(getProjectRoot(), ".env"));

  for (const filePath of candidates) {
    if (!filePath || !fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();

      value = value.replace(/^["']|["']$/g, "");

      if (key && values[key] === undefined) {
        values[key] = value;
      }
    }
  }

  return values;
}

function getEnvValue(name) {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;

  const values = readEnvFileValues();
  return values[name] || "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getScanInboxFilePathByName(fileName) {
  const dir = getReceiptScanInboxDir();
  const safeName = path.basename(fileName || "");
  const filePath = path.resolve(dir, safeName);

  if (!safeName) {
    throw new Error("fileName is required");
  }

  if (!filePath.startsWith(path.resolve(dir) + path.sep)) {
    throw new Error("invalid fileName");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error("画像ファイルが見つかりません: " + safeName);
  }

  return filePath;
}

function countOcrLines(rawText) {
  return String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function countOcrWords(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return 0;

  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;
}

function extractOcrRawText(result) {
  if (result && result.analyzeResult && result.analyzeResult.content) {
    return String(result.analyzeResult.content || "");
  }

  const pages = result && result.analyzeResult && result.analyzeResult.pages
    ? result.analyzeResult.pages
    : [];

  const lines = [];

  for (const page of pages) {
    for (const line of page.lines || []) {
      if (line.content) lines.push(line.content);
    }
  }

  return lines.join("\n");
}

async function runAzureReadOcrForFile(filePath) {
  const endpoint = getEnvValue("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT").replace(/\/+$/, "");
  const key = getEnvValue("AZURE_DOCUMENT_INTELLIGENCE_KEY");

  if (!endpoint) {
    throw new Error("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT is missing");
  }

  if (!key) {
    throw new Error("AZURE_DOCUMENT_INTELLIGENCE_KEY is missing");
  }

  const apiVersion = getEnvValue("AZURE_DOCUMENT_INTELLIGENCE_API_VERSION") || "2024-11-30";
  const url = endpoint + "/documentintelligence/documentModels/prebuilt-read:analyze?api-version=" + encodeURIComponent(apiVersion);

  const startRes = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": getImageContentType(filePath),
    },
    body: fs.readFileSync(filePath),
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

  for (let i = 0; i < 40; i++) {
    await sleep(1000);

    const pollRes = await fetch(operationLocation, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
      },
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

  const rawText = extractOcrRawText(result);

  return {
    provider: "azure-document-intelligence-read",
    rawText,
    lineCount: countOcrLines(rawText),
    wordCount: countOcrWords(rawText),
  };
}


function getReceiptImportSubDir(envName, fallbackName) {
  const fromEnv = getEnvValue(envName);

  if (fromEnv) {
    return path.resolve(getProjectRoot(), fromEnv);
  }

  return path.resolve(
    getProjectRoot(),
    "ORIGIN会計ソフト",
    "レシート関係",
    fallbackName
  );
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function makeSafeFileName(fileName) {
  const base = path.basename(fileName || "receipt");
  return base.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
}

function getUniqueFilePath(dir, fileName) {
  ensureDir(dir);

  const safeName = makeSafeFileName(fileName);
  const ext = path.extname(safeName);
  const base = path.basename(safeName, ext);

  let candidate = path.join(dir, safeName);
  let count = 1;

  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, base + "_" + String(count).padStart(3, "0") + ext);
    count++;
  }

  return candidate;
}

function makeLocalImportBatchId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  return "LOCAL-" +
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds());
}

function moveFileToDir(filePath, envName, fallbackName) {
  const dir = getReceiptImportSubDir(envName, fallbackName);
  const destPath = getUniqueFilePath(dir, path.basename(filePath));

  fs.renameSync(filePath, destPath);

  return destPath;
}

async function handleReceiptRoutes(req, res) {
  const pathname = getPathname(req);
  

  

  

  if (req.method === "POST" && pathname === "/api/receipts/scan-inbox/import-all") {
    try {
      const inbox = listReceiptScanInboxFiles();
      const files = inbox.files || [];

      const normalLimit = Number(getEnvValue("RECEIPT_BATCH_NORMAL_LIMIT") || process.env.RECEIPT_BATCH_NORMAL_LIMIT || 20);
      const hardLimit = Number(getEnvValue("RECEIPT_BATCH_HARD_LIMIT") || process.env.RECEIPT_BATCH_HARD_LIMIT || 50);
      const force = getSearchParam(req, "force") === "1";

      if (!files.length) {
        sendJson(res, 200, {
          ok: true,
          message: "処理対象の画像はありません。",
          count: 0,
          results: [],
        });
        return true;
      }

      if (files.length > hardLimit) {
        sendJson(res, 400, {
          ok: false,
          error: "一度に処理できる上限は " + hardLimit + " 件です。フォルダを分けてください。",
          count: files.length,
          hardLimit,
        });
        return true;
      }

      if (files.length > normalLimit && !force) {
        sendJson(res, 409, {
          ok: false,
          requireForce: true,
          error: files.length + " 件あります。時間がかかるため、続行確認が必要です。",
          count: files.length,
          normalLimit,
          hardLimit,
        });
        return true;
      }

      const batchId = makeLocalImportBatchId();
      const results = [];

      for (const file of files) {
        let sourcePath = "";
        let movedPath = "";

        try {
          sourcePath = getScanInboxFilePathByName(file.fileName);

          const stat = fs.statSync(sourcePath);
          const hash = sha256File(sourcePath);

          const existing = await repo.getImportByImageHashSha256(hash);

          if (existing) {
            const duplicatePath = moveFileToDir(
              sourcePath,
              "RECEIPT_DUPLICATE_DIR",
              "duplicate"
            );

            results.push({
              fileName: file.fileName,
              status: "duplicate",
              message: "重複",
              duplicatePath,
              existingId: existing.id,
            });

            continue;
          }

          const ocr = await runAzureReadOcrForFile(sourcePath);

          movedPath = moveFileToDir(
            sourcePath,
            "RECEIPT_IMPORTED_DIR",
            "imported"
          );

          const saved = await repo.createLocalImport({
            uploadId: batchId + "-" + hash.slice(0, 12),
            localImageFileName: path.basename(movedPath),
            localImagePath: movedPath,
            imageHashSha256: hash,
            imageSizeBytes: stat.size,
            originalFileName: path.basename(sourcePath),
            capturedAtJst: stat.mtime,
            importBatchId: batchId,
            ocrProvider: ocr.provider,
            ocrRawText: ocr.rawText,
            ocrLineCount: ocr.lineCount,
            ocrWordCount: ocr.wordCount,
          });

          results.push({
            fileName: file.fileName,
            status: "imported",
            message: "取込成功",
            id: saved.id,
            lineCount: ocr.lineCount,
            wordCount: ocr.wordCount,
          });

        } catch (error) {
          let errorPath = "";

          try {
            if (sourcePath && fs.existsSync(sourcePath)) {
              errorPath = moveFileToDir(sourcePath, "RECEIPT_ERROR_DIR", "error");
            } else if (movedPath && fs.existsSync(movedPath)) {
              errorPath = moveFileToDir(movedPath, "RECEIPT_ERROR_DIR", "error");
            }
          } catch (_) {}

          results.push({
            fileName: file.fileName,
            status: "error",
            message: "取込失敗",
            error: error.message || String(error),
            errorPath,
          });
        }
      }

      const importedCount = results.filter((r) => r.status === "imported").length;
      const duplicateCount = results.filter((r) => r.status === "duplicate").length;
      const errorCount = results.filter((r) => r.status === "error").length;

      sendJson(res, 200, {
        ok: true,
        message: "全件処理が完了しました。",
        batchId,
        count: results.length,
        importedCount,
        duplicateCount,
        errorCount,
        results,
      });

    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || String(error),
      });
    }

    return true;
  }
if (req.method === "POST" && pathname === "/api/receipts/scan-inbox/import-one") {
    let sourcePath = "";
    let movedPath = "";

    try {
      const fileName = getSearchParam(req, "fileName");
      sourcePath = getScanInboxFilePathByName(fileName);

      const stat = fs.statSync(sourcePath);
      const hash = sha256File(sourcePath);

      const existing = await repo.getImportByImageHashSha256(hash);

      if (existing) {
        const duplicatePath = moveFileToDir(
          sourcePath,
          "RECEIPT_DUPLICATE_DIR",
          "duplicate"
        );

        sendJson(res, 200, {
          ok: true,
          duplicate: true,
          message: "重複のためduplicateへ移動しました。",
          fileName: path.basename(sourcePath),
          duplicatePath,
          existing,
        });

        return true;
      }

      const ocr = await runAzureReadOcrForFile(sourcePath);

      const batchId = makeLocalImportBatchId();

      movedPath = moveFileToDir(
        sourcePath,
        "RECEIPT_IMPORTED_DIR",
        "imported"
      );

      const saved = await repo.createLocalImport({
        uploadId: batchId + "-" + hash.slice(0, 12),
        localImageFileName: path.basename(movedPath),
        localImagePath: movedPath,
        imageHashSha256: hash,
        imageSizeBytes: stat.size,
        originalFileName: path.basename(sourcePath),
        capturedAtJst: stat.mtime,
        importBatchId: batchId,
        ocrProvider: ocr.provider,
        ocrRawText: ocr.rawText,
        ocrLineCount: ocr.lineCount,
        ocrWordCount: ocr.wordCount,
      });

      sendJson(res, 200, {
        ok: true,
        duplicate: false,
        message: "レシートを取り込みました。",
        item: saved,
      });

    } catch (error) {
      if (movedPath && fs.existsSync(movedPath)) {
        try {
          moveFileToDir(movedPath, "RECEIPT_ERROR_DIR", "error");
        } catch (_) {}
      }

      sendJson(res, 500, {
        ok: false,
        error: error.message || String(error),
      });
    }

    return true;
  }
if (req.method === "GET" && pathname === "/api/receipts/scan-inbox/ocr") {
    try {
      const fileName = getSearchParam(req, "fileName");
      const filePath = getScanInboxFilePathByName(fileName);
      const ocr = await runAzureReadOcrForFile(filePath);

      sendJson(res, 200, {
        ok: true,
        fileName: path.basename(filePath),
        filePath,
        provider: ocr.provider,
        lineCount: ocr.lineCount,
        wordCount: ocr.wordCount,
        rawText: ocr.rawText,
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || String(error),
      });
    }

    return true;
  }
if (req.method === "GET" && pathname === "/api/receipts/scan-inbox/image") {
    try {
      const fileName = getSearchParam(req, "fileName");

      if (!fileName) {
        sendText(res, 400, "fileName is required");
        return true;
      }

      const dir = getReceiptScanInboxDir();
      const safeName = path.basename(fileName);
      const filePath = path.resolve(dir, safeName);

      if (!filePath.startsWith(path.resolve(dir) + path.sep)) {
        sendText(res, 400, "invalid fileName");
        return true;
      }

      if (!fs.existsSync(filePath)) {
        sendText(res, 404, "画像ファイルが見つかりません。");
        return true;
      }

      res.writeHead(200, {
        "Content-Type": getImageContentType(filePath),
      });

      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      sendText(res, 500, error.message || String(error));
    }

    return true;
  }



  

  if (req.method === "GET" && pathname === "/api/receipts/scan-inbox") {
    try {
      const result = listReceiptScanInboxFiles();

      sendJson(res, 200, {
        ok: true,
        dir: result.dir,
        missing: result.missing,
        count: result.files.length,
        normalLimit: Number(process.env.RECEIPT_BATCH_NORMAL_LIMIT || 20),
        hardLimit: Number(process.env.RECEIPT_BATCH_HARD_LIMIT || 50),
        items: result.files,
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || String(error),
      });
    }

    return true;
  }
if (req.method === "GET" && pathname === "/api/receipts/imports") {
    const items = await repo.listImports(
      getSearchParam(req, "limit"),
      getSearchParam(req, "offset")
    );

    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
    });

    return true;
  }

  const detailMatch = pathname.match(/^\/api\/receipts\/imports\/(\d+)$/);

  if (req.method === "GET" && detailMatch) {
    const item = await repo.getImportById(Number(detailMatch[1]));

    if (!item) {
      sendJson(res, 404, {
        ok: false,
        error: "レシートが見つかりません。",
      });

      return true;
    }

    const drafts = await repo.getAiDrafts(item.id);

    sendJson(res, 200, {
      ok: true,
      item,
      aiDrafts: drafts,
    });

    return true;
  }

  const analyzeMatch = pathname.match(/^\/api\/receipts\/imports\/(\d+)\/analyze$/);

  if (req.method === "POST" && analyzeMatch) {
    const id = Number(analyzeMatch[1]);
    const item = await repo.getImportById(id);

    if (!item) {
      sendJson(res, 404, {
        ok: false,
        error: "レシートが見つかりません。",
      });

      return true;
    }

    try {
      const analyzed = await ai.analyzeReceiptImport(item);
      const saved = await repo.createAiDraft(item.id, analyzed);

      sendJson(res, 200, {
        ok: true,
        message: "AI下書きを作成しました。",
        draft: saved,
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message,
      });
    }

    return true;
  }

  const draftMatch = pathname.match(/^\/api\/receipts\/ai-drafts\/(\d+)$/);

  if ((req.method === "PUT" || req.method === "PATCH") && draftMatch) {
    try {
      const body = await readJsonBody(req);
      const saved = await repo.updateAiDraft(Number(draftMatch[1]), body);

      if (!saved) {
        sendJson(res, 404, {
          ok: false,
          error: "AI下書きが見つかりません。",
        });

        return true;
      }

      sendJson(res, 200, {
        ok: true,
        message: "候補を保存しました。",
        draft: saved,
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message,
      });
    }

    return true;
  }

  const imageMatch = pathname.match(/^\/api\/receipts\/image\/(\d+)$/);

  if (req.method === "GET" && imageMatch) {
    const item = await repo.getImportById(Number(imageMatch[1]));

    if (!item) {
      sendText(res, 404, "レシートが見つかりません。");
      return true;
    }

    if (!item.local_image_path) {
      sendText(res, 404, "画像パスがありません。");
      return true;
    }

    if (!fs.existsSync(item.local_image_path)) {
      sendText(res, 404, "画像ファイルが見つかりません: " + item.local_image_path);
      return true;
    }

    res.writeHead(200, {
      "Content-Type": getImageContentType(item.local_image_path),
    });

    fs.createReadStream(item.local_image_path).pipe(res);
    return true;
  }

  return false;
}

module.exports = {
  handleReceiptRoutes,
};






