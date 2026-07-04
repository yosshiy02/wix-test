const { sendJson, readBody } = require("../response");
const repo = require("./master.repository");

function parsePath(url) {
  const parsed = new URL(url, "http://localhost");
  return {
    pathname: parsed.pathname,
    searchParams: parsed.searchParams
  };
}

async function handleMasterRoutes(req, res) {
  const { pathname, searchParams } = parsePath(req.url);

  if (req.method === "GET" && pathname === "/api/masters/types") {
    sendJson(res, 200, {
      ok: true,
      types: repo.getMasterTypes()
    });

    return true;
  }

  if (req.method === "GET" && pathname === "/api/masters") {
    const type = searchParams.get("type");
    const items = await repo.listMaster(type);

    sendJson(res, 200, {
      ok: true,
      type,
      items
    });

    return true;
  }

  if (req.method === "POST" && pathname === "/api/masters") {
    const raw = await readBody(req);
    const payload = JSON.parse(raw || "{}");

    const item = await repo.createMaster(payload.type, payload);

    sendJson(res, 200, {
      ok: true,
      message: "追加しました。",
      item
    });

    return true;
  }

  const updateMatch = pathname.match(/^\/api\/masters\/([^\/]+)\/(\d+)$/);

  if (req.method === "PUT" && updateMatch) {
    const type = updateMatch[1];
    const id = updateMatch[2];

    const raw = await readBody(req);
    const payload = JSON.parse(raw || "{}");

    const item = await repo.updateMaster(type, id, payload);

    sendJson(res, 200, {
      ok: true,
      message: "更新しました。",
      item
    });

    return true;
  }

  return false;
}

module.exports = {
  handleMasterRoutes
};
