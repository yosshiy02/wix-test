import http from "node:http";
import crypto from "node:crypto";
import { URL } from "node:url";

const port = Number(process.env.PORT || 3210);

const config = {
  storeCode: process.env.STORE_CODE || "RASIM",
  storeName: process.env.STORE_NAME || "Rasiːm",
  storeAliasEmail:
    process.env.STORE_ALIAS_EMAIL || "rasi-m@hatodaiya.com",
  allowedOrigins: String(
    process.env.ALLOWED_ORIGINS ||
    "http://127.0.0.1:5500,http://localhost:5500"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
};

const messages = [
  {
    id: "mail_demo_001",
    threadId: "thread_demo_001",
    storeCode: config.storeCode,
    storeName: config.storeName,
    aliasEmail: config.storeAliasEmail,
    fromName: "田中 一郎",
    fromEmail: "tanaka@example.com",
    subject: "商品の在庫確認について",
    body:
      "お世話になっております。\n\n" +
      "今週末に受け取りを予定しております。" +
      "対象商品の在庫があるかご確認をお願いいたします。\n\n" +
      "どうぞよろしくお願いいたします。",
    receivedAt: new Date().toISOString(),
    status: "new",
    assignee: null,
    internalMemo: "",
    replies: []
  }
];

function sendJson(response, statusCode, payload, origin = "") {
  const body = JSON.stringify(payload, null, 2);

  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin":
      config.allowedOrigins.includes(origin) ? origin : "null",
    "Access-Control-Allow-Methods":
      "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type,Authorization,X-Link-Token",
    "Vary": "Origin"
  });

  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;

      if (raw.length > 1024 * 1024) {
        reject(new Error("REQUEST_TOO_LARGE"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });

    request.on("error", reject);
  });
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function publicMessage(message) {
  return {
    id: message.id,
    threadId: message.threadId,
    storeCode: message.storeCode,
    storeName: message.storeName,
    aliasEmail: message.aliasEmail,
    fromName: message.fromName,
    fromEmail: message.fromEmail,
    subject: message.subject,
    body: message.body,
    receivedAt: message.receivedAt,
    status: message.status,
    assignee: message.assignee,
    internalMemo: message.internalMemo,
    replies: message.replies
  };
}

const server = http.createServer(async (request, response) => {
  const origin = String(request.headers.origin || "");
  const url = new URL(
    request.url || "/",
    `http://${request.headers.host || "localhost"}`
  );

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {}, origin);
    return;
  }

  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        system: "HD ORGIN STYLE MAIL SYSTEM",
        store: {
          code: config.storeCode,
          name: config.storeName,
          aliasEmail: config.storeAliasEmail
        },
        googleWorkspaceConnected: false,
        mode: "local-prototype"
      }, origin);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/messages") {
      sendJson(response, 200, {
        messages: messages.map(publicMessage)
      }, origin);
      return;
    }

    const messageMatch =
      url.pathname.match(/^\/api\/messages\/([^/]+)$/);

    if (
      request.method === "GET" &&
      messageMatch
    ) {
      const message = messages.find(
        (item) => item.id === messageMatch[1]
      );

      if (!message) {
        sendJson(response, 404, {
          ok: false,
          error: "MESSAGE_NOT_FOUND"
        }, origin);
        return;
      }

      sendJson(response, 200, {
        message: publicMessage(message)
      }, origin);
      return;
    }

    const statusMatch =
      url.pathname.match(/^\/api\/messages\/([^/]+)\/status$/);

    if (
      request.method === "PATCH" &&
      statusMatch
    ) {
      const message = messages.find(
        (item) => item.id === statusMatch[1]
      );

      if (!message) {
        sendJson(response, 404, {
          ok: false,
          error: "MESSAGE_NOT_FOUND"
        }, origin);
        return;
      }

      const body = await readJson(request);
      const allowedStatuses = ["new", "progress", "done"];

      if (!allowedStatuses.includes(body.status)) {
        sendJson(response, 400, {
          ok: false,
          error: "INVALID_STATUS"
        }, origin);
        return;
      }

      message.status = body.status;

      if (typeof body.assignee === "string") {
        message.assignee = body.assignee.trim() || null;
      }

      sendJson(response, 200, {
        ok: true,
        message: publicMessage(message)
      }, origin);
      return;
    }

    const memoMatch =
      url.pathname.match(/^\/api\/messages\/([^/]+)\/memo$/);

    if (
      request.method === "PATCH" &&
      memoMatch
    ) {
      const message = messages.find(
        (item) => item.id === memoMatch[1]
      );

      if (!message) {
        sendJson(response, 404, {
          ok: false,
          error: "MESSAGE_NOT_FOUND"
        }, origin);
        return;
      }

      const body = await readJson(request);
      message.internalMemo = String(body.internalMemo || "");

      sendJson(response, 200, {
        ok: true,
        message: publicMessage(message)
      }, origin);
      return;
    }

    const replyMatch =
      url.pathname.match(/^\/api\/messages\/([^/]+)\/reply$/);

    if (
      request.method === "POST" &&
      replyMatch
    ) {
      const message = messages.find(
        (item) => item.id === replyMatch[1]
      );

      if (!message) {
        sendJson(response, 404, {
          ok: false,
          error: "MESSAGE_NOT_FOUND"
        }, origin);
        return;
      }

      const body = await readJson(request);
      const replyBody = String(body.body || "").trim();

      if (!replyBody) {
        sendJson(response, 400, {
          ok: false,
          error: "REPLY_BODY_REQUIRED"
        }, origin);
        return;
      }

      const reply = {
        id: createId("reply"),
        from: config.storeAliasEmail,
        to: message.fromEmail,
        subject:
          String(body.subject || "").trim() ||
          `Re: ${message.subject}`,
        body: replyBody,
        createdAt: new Date().toISOString(),
        deliveryStatus: "prototype-not-sent"
      };

      message.replies.push(reply);
      message.status = "done";

      sendJson(response, 201, {
        ok: true,
        note:
          "現在は静的試作です。" +
          "Google Workspaceからはまだ送信していません。",
        reply,
        message: publicMessage(message)
      }, origin);
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/google/pubsub"
    ) {
      sendJson(response, 501, {
        ok: false,
        error: "GOOGLE_WORKSPACE_NOT_CONNECTED_YET"
      }, origin);
      return;
    }

    sendJson(response, 404, {
      ok: false,
      error: "ROUTE_NOT_FOUND"
    }, origin);
  } catch (error) {
    console.error(error);

    sendJson(response, 500, {
      ok: false,
      error: "INTERNAL_SERVER_ERROR"
    }, origin);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log("================================================");
  console.log("HD ORGIN STYLE MAIL SYSTEM BACKEND");
  console.log("================================================");
  console.log(`URL=http://127.0.0.1:${port}`);
  console.log(`STORE_NAME=${config.storeName}`);
  console.log(`STORE_ALIAS_EMAIL=${config.storeAliasEmail}`);
  console.log("GOOGLE_WORKSPACE_CONNECTED=NO");
  console.log("MODE=LOCAL_PROTOTYPE");
});