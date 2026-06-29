import { ok, badRequest, forbidden, serverError } from "wix-http-functions";
import wixData from "wix-data";
import { getSecret } from "wix-secrets-backend";

const COLLECTION_ID = "ReceiptUploads";
const API_KEY_SECRET_NAME = "HD_ORIGIN_RECEIPT_API_KEY";

function jsonResponse(body) {
  return {
    headers: {
      "Content-Type": "application/json"
    },
    body: body
  };
}

function getHeader(request, name) {
  const headers = request.headers || {};
  const lowerName = name.toLowerCase();

  if (typeof headers.get === "function") {
    return headers.get(name) || headers.get(lowerName);
  }

  return headers[name] || headers[lowerName] || "";
}

async function requireApiKey(request) {
  const expected = await getSecret(API_KEY_SECRET_NAME);
  const actual = getHeader(request, "x-hd-origin-key");

  if (!expected || !actual || actual !== expected) {
    throw new Error("FORBIDDEN");
  }
}

function toJstDateTimeText(date = new Date()) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  const s = String(jst.getUTCSeconds()).padStart(2, "0");

  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

function cleanReceiptItem(item) {
  return {
    _id: item._id,
    uploadId: item.uploadId || "",
    title: item.title || "",
    imageUrl: item.imageUrl || "",
    imageSizeBytes: item.imageSizeBytes || null,
    originalFileName: item.originalFileName || "",
    capturedAtJst: item.capturedAtJst || "",
    status: item.status || "",
    receiptJson: item.receiptJson || null
  };
}

export async function get_receiptPending(request) {
  try {
    await requireApiKey(request);

    const limitText = request.query && request.query.limit
      ? String(request.query.limit)
      : "20";

    let limit = Number(limitText);

    if (Number.isNaN(limit) || limit < 1) {
      limit = 20;
    }

    if (limit > 50) {
      limit = 50;
    }

    const result = await wixData.query(COLLECTION_ID)
      .eq("status", "ocr_done")
      .ascending("capturedAtJst")
      .limit(limit)
      .find({ suppressAuth: true });

    return ok(jsonResponse({
      ok: true,
      count: result.items.length,
      items: result.items.map(cleanReceiptItem)
    }));

  } catch (err) {
    if (err && err.message === "FORBIDDEN") {
      return forbidden(jsonResponse({
        ok: false,
        message: "Forbidden"
      }));
    }

    console.error("get_receiptPending error:", err);

    return serverError(jsonResponse({
      ok: false,
      message: err && err.message ? err.message : String(err)
    }));
  }
}

export async function post_receiptMarkImported(request) {
  try {
    await requireApiKey(request);

    const body = await request.body.json();

    const ids = Array.isArray(body.ids) ? body.ids : [];
    const importBatchId = body.importBatchId || "";
    const importedAtJst = body.importedAtJst || toJstDateTimeText(new Date());
    const importedItems = Array.isArray(body.items) ? body.items : [];

    if (ids.length === 0 && importedItems.length === 0) {
      return badRequest(jsonResponse({
        ok: false,
        message: "ids または items が空です。"
      }));
    }

    const itemMap = {};

    for (const item of importedItems) {
      if (item && item._id) {
        itemMap[item._id] = item;
      }
    }

    const targetIds = ids.length > 0
      ? ids
      : importedItems.map((item) => item._id).filter(Boolean);

    const updated = [];
    const failed = [];

    for (const id of targetIds) {
      try {
        const current = await wixData.get(COLLECTION_ID, id, { suppressAuth: true });
        const local = itemMap[id] || {};

        const next = {
          ...current,
          status: "imported",
          importBatchId: importBatchId,
          importedAtJst: importedAtJst,
          localImageFileName: local.localImageFileName || current.localImageFileName || "",
          localImagePath: local.localImagePath || current.localImagePath || "",
          imageHashSha256: local.imageHashSha256 || current.imageHashSha256 || ""
        };

        const saved = await wixData.update(COLLECTION_ID, next, { suppressAuth: true });

        updated.push({
          _id: saved._id,
          uploadId: saved.uploadId || "",
          status: saved.status
        });

      } catch (oneErr) {
        failed.push({
          _id: id,
          message: oneErr && oneErr.message ? oneErr.message : String(oneErr)
        });
      }
    }

    return ok(jsonResponse({
      ok: failed.length === 0,
      updatedCount: updated.length,
      failedCount: failed.length,
      updated: updated,
      failed: failed
    }));

  } catch (err) {
    if (err && err.message === "FORBIDDEN") {
      return forbidden(jsonResponse({
        ok: false,
        message: "Forbidden"
      }));
    }

    console.error("post_receiptMarkImported error:", err);

    return serverError(jsonResponse({
      ok: false,
      message: err && err.message ? err.message : String(err)
    }));
  }
}
