const { sendJson } = require("../response");
const repo = require("./payables.repository");
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    const limit = 5 * 1024 * 1024;
    req.on("data", chunk => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > limit) {
        reject(new Error("リクエスト本文が大きすぎます。"));
        req.destroy();
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
        reject(new Error("JSONの読み込みに失敗しました: " + error.message));
      }
    });
    req.on("error", reject);
  });
}
function parseUrl(req) {
  return new URL(req.url, "http://localhost");
}
function idFromParts(parts, index) {
  const n = Number(parts[index]);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}
async function handlePayableRoutes(req, res) {
  const url = parseUrl(req);
  const pathname = url.pathname;
  if (!pathname.startsWith("/api/payables")) {
    return false;
  }
  const parts = pathname.split("/").filter(Boolean);
  try {
    if (req.method === "GET" && pathname === "/api/payables/summary") {
      const summary = await repo.getDashboard();
      sendJson(res, 200, { ok: true, summary });
      return true;
    }
    if (req.method === "GET" && pathname === "/api/payables") {
      const items = await repo.listPayables({
        status: url.searchParams.get("status") || "",
        vendor: url.searchParams.get("vendor") || "",
        from: url.searchParams.get("from") || "",
        to: url.searchParams.get("to") || "",
        dueFrom: url.searchParams.get("dueFrom") || "",
        dueTo: url.searchParams.get("dueTo") || "",
        overdue: url.searchParams.get("overdue") || "",
        company:
          url.searchParams.get("company") || "",
        evidenceStatus:
          url.searchParams.get("evidenceStatus") || "",
        reviewStatus:
          url.searchParams.get("reviewStatus") || "",
        professionalReviewStatus:
          url.searchParams.get(
            "professionalReviewStatus"
          ) || "",
        evidenceOverdue:
          url.searchParams.get("evidenceOverdue") || ""
      });
      const summary = await repo.getDashboard();
      sendJson(res, 200, { ok: true, items, summary });
      return true;
    }
    if (req.method === "GET" && parts.length === 3) {
      const payableId = idFromParts(parts, 2);
      if (!payableId) {
        sendJson(res, 400, { ok: false, error: "payable_id が不正です。" });
        return true;
      }
      const payable = await repo.getPayable(payableId);
      if (!payable) {
        sendJson(res, 404, { ok: false, error: "請求書・未払データが見つかりません。" });
        return true;
      }
      sendJson(res, 200, { ok: true, payable });
      return true;
    }
    if (req.method === "POST" && pathname === "/api/payables") {
      const payload = await readJson(req);
      const result = await repo.savePayable(payload);
      sendJson(res, 200, { ok: true, result });
      return true;
    }
    if (req.method === "PUT" && parts.length === 3) {
      const payableId = idFromParts(parts, 2);
      const payload = await readJson(req);
      payload.document = payload.document || {};
      payload.document.payable_id = payableId;
      const result = await repo.savePayable(payload);
      sendJson(res, 200, { ok: true, result });
      return true;
    }
    if (req.method === "DELETE" && parts.length === 3) {
      const payableId = idFromParts(parts, 2);
      const result = await repo.deletePayable(payableId);
      sendJson(res, 200, { ok: true, result });
      return true;
    }
    if (req.method === "POST" && parts.length === 4 && parts[3] === "payments") {
      const payableId = idFromParts(parts, 2);
      const payload = await readJson(req);
      const result = await repo.addPayment(payableId, payload);
      sendJson(res, 200, { ok: true, result });
      return true;
    }
    if (req.method === "DELETE" && parts.length === 5 && parts[3] === "payments") {
      const payableId = idFromParts(parts, 2);
      const paymentId = idFromParts(parts, 4);
      const result = await repo.deletePayment(payableId, paymentId);
      sendJson(res, 200, { ok: true, result });
      return true;
    }
    sendJson(res, 404, { ok: false, error: "payables API not found" });
    return true;
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
    return true;
  }
}
module.exports = {
  handlePayableRoutes
};
