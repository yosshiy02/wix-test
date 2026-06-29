const fs = require("fs");
const path = require("path");
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

async function handleReceiptRoutes(req, res) {
  const pathname = getPathname(req);

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