const pool = require("../db");
const { sendJson, readBody, csvEscape } = require("../response");

async function handleItemsRoutes(req, res) {
  if (req.method === "GET" && req.url === "/api/health") {
    const result = await pool.query("SELECT NOW() AS now");

    sendJson(res, 200, {
      ok: true,
      message: "PostgreSQL connected",
      db_time: result.rows[0].now
    });

    return true;
  }

  if (req.method === "GET" && req.url === "/api/items") {
    const result = await pool.query(`
      SELECT id, received_at, type, amount, name, deal_date, memo, payload
      FROM received_items
      ORDER BY id DESC
      LIMIT 100
    `);

    sendJson(res, 200, result.rows);
    return true;
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

    sendJson(res, 200, {
      ok: true,
      saved: result.rows[0]
    });

    return true;
  }

  if (req.method === "GET" && req.url === "/api/items.csv") {
    const result = await pool.query(`
      SELECT id, received_at, type, amount, name, deal_date, memo
      FROM received_items
      ORDER BY id ASC
    `);

    const header = ["id", "received_at", "type", "amount", "name", "deal_date", "memo"];
    const lines = [header.join(",")];

    for (const row of result.rows) {
      lines.push([
        row.id,
        row.received_at,
        row.type,
        row.amount,
        row.name,
        row.deal_date,
        row.memo
      ].map(csvEscape).join(","));
    }

    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=received_items.csv"
    });
    res.end("\uFEFF" + lines.join("\r\n"));

    return true;
  }

  return false;
}

module.exports = {
  handleItemsRoutes,
};
