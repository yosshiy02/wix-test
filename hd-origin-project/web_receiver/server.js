const http = require("http");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "public");

const pool = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/health") {
    const result = await pool.query("SELECT NOW() AS now");
    return sendJson(res, 200, {
      ok: true,
      message: "PostgreSQL connected",
      db_time: result.rows[0].now
    });
  }

  if (req.method === "GET" && req.url === "/api/items") {
    const result = await pool.query(`
      SELECT id, received_at, type, amount, name, deal_date, memo, payload
      FROM received_items
      ORDER BY id DESC
      LIMIT 100
    `);
    return sendJson(res, 200, result.rows);
  }

  if (req.method === "POST" && req.url === "/api/test") {
    const raw = await readBody(req);
    const payload = JSON.parse(raw || "{}");

    const result = await pool.query(
      `
      INSERT INTO received_items
        (type, amount, name, deal_date, memo, payload)
      VALUES
        ($1, NULLIF($2, '')::numeric, $3, NULLIF($4, '')::date, $5, $6::jsonb)
      RETURNING id, received_at, type, amount, name, deal_date, memo, payload
      `,
      [
        payload.type || "",
        payload.amount || "",
        payload.name || "",
        payload.date || "",
        payload.memo || "",
        JSON.stringify(payload)
      ]
    );

    return sendJson(res, 200, {
      ok: true,
      saved: result.rows[0]
    });
  }

  return sendJson(res, 404, { ok: false, error: "API not found" });
}

function serveStatic(req, res) {
  const reqPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const fullPath = path.join(publicDir, decodeURIComponent(reqPath));

  if (!fullPath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }

    const ext = path.extname(fullPath).toLowerCase();
    const type =
      ext === ".html" ? "text/html; charset=utf-8" :
      ext === ".js" ? "text/javascript; charset=utf-8" :
      ext === ".css" ? "text/css; charset=utf-8" :
      "application/octet-stream";

    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
    } else {
      serveStatic(req, res);
    }
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { ok: false, error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`HD Origin Project running: http://localhost:${PORT}`);
});
