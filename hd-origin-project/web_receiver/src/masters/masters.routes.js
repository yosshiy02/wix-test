const { sendJson, readBody } = require("../response");
const repo = require("./master.repository");
const businessPartnerRepo = require("./businessPartner.repository");
const companyRuleRepo = require("./companyRule.repository");

function normalizeUrl(url) {
  return String(url || "").split("?")[0].replace(/\/+$/, "");
}

function parseMasterType(url) {
  const clean = normalizeUrl(url);

  let match = clean.match(/^\/api\/masters\/([^\/]+)$/);
  if (match) return decodeURIComponent(match[1]);

  match = clean.match(/^\/api\/master\/([^\/]+)$/);
  if (match) return decodeURIComponent(match[1]);

  return null;
}

function parseMasterTarget(url) {
  const clean = normalizeUrl(url);

  let match = clean.match(/^\/api\/masters\/([^\/]+)\/(\d+)$/);
  if (match) {
    return {
      type: decodeURIComponent(match[1]),
      id: Number(match[2])
    };
  }

  match = clean.match(/^\/api\/master\/([^\/]+)\/(\d+)$/);
  if (match) {
    return {
      type: decodeURIComponent(match[1]),
      id: Number(match[2])
    };
  }

  return null;
}

async function readJson(req) {
  const raw = await readBody(req);
  return JSON.parse(raw || "{}");
}

async function handleBusinessPartnerRoutes(req, res) {
  const parsed = new URL(req.url, "http://localhost");
  const pathname = parsed.pathname;

  let match = pathname.match(
    /^\/api\/business-partners\/(customer|vendor)$/
  );

  if (req.method === "GET" && match) {
    const rows = await businessPartnerRepo.listPartners(match[1]);

    sendJson(res, 200, {
      ok: true,
      type: match[1],
      rows,
      items: rows
    });

    return true;
  }

  if (req.method === "POST" && match) {
    const payload = await readJson(req);
    const row = await businessPartnerRepo.saveSingle(match[1], payload);

    sendJson(res, 200, {
      ok: true,
      row,
      item: row
    });

    return true;
  }

  match = pathname.match(
    /^\/api\/business-partners\/(customer|vendor)\/(\d+)$/
  );

  if (req.method === "PUT" && match) {
    const payload = await readJson(req);

    const row = await businessPartnerRepo.saveSingle(match[1], {
      ...payload,
      id: Number(match[2])
    });

    sendJson(res, 200, {
      ok: true,
      row,
      item: row
    });

    return true;
  }

  if (req.method === "DELETE" && match) {
    const row = await businessPartnerRepo.disablePartner(
      match[1],
      Number(match[2])
    );

    sendJson(res, 200, {
      ok: true,
      row,
      item: row
    });

    return true;
  }

  match = pathname.match(
    /^\/api\/business-partners\/(customer|vendor)\/csv-import$/
  );

  if (req.method === "POST" && match) {
    const payload = await readJson(req);

    const result = await businessPartnerRepo.importPartners(
      match[1],
      payload
    );

    sendJson(res, 200, {
      ok: true,
      result
    });

    return true;
  }

  return false;
}

/* GPT00_BUSINESS_PARTNER_API_20260712_START */
/* GPT00_BUSINESS_PARTNER_API_20260712_END */
/* GPT00_COMPANY_TRANSACTION_RULE_API_20260712_START */
async function handleCompanyTransactionRuleRoutes(req, res) {
  const parsed = new URL(req.url, "http://localhost");
  const pathname = parsed.pathname;

  if (
    req.method === "GET" &&
    pathname === "/api/company-transaction-rules/companies"
  ) {
    const rows = await companyRuleRepo.listCompanies();

    sendJson(res, 200, {
      ok: true,
      rows,
      items: rows
    });

    return true;
  }

  if (
    req.method === "GET" &&
    pathname === "/api/company-transaction-rules"
  ) {
    const rows = await companyRuleRepo.listRules({
      company_id: parsed.searchParams.get("company_id"),
      transaction_direction:
        parsed.searchParams.get("transaction_direction"),
      active_only:
        parsed.searchParams.get("active_only")
    });

    sendJson(res, 200, {
      ok: true,
      rows,
      items: rows
    });

    return true;
  }

  if (
    req.method === "POST" &&
    pathname === "/api/company-transaction-rules"
  ) {
    const payload = await readJson(req);
    const row = await companyRuleRepo.saveRule(null, payload);

    sendJson(res, 200, {
      ok: true,
      message: "会社別ルールを登録しました。",
      row,
      item: row
    });

    return true;
  }

  let match = pathname.match(
    /^\/api\/company-transaction-rules\/(\d+)$/
  );

  if (req.method === "PUT" && match) {
    const payload = await readJson(req);

    const row = await companyRuleRepo.saveRule(
      Number(match[1]),
      payload
    );

    sendJson(res, 200, {
      ok: true,
      message: "会社別ルールを更新しました。",
      row,
      item: row
    });

    return true;
  }

  if (req.method === "DELETE" && match) {
    const row = await companyRuleRepo.disableRule(
      Number(match[1])
    );

    sendJson(res, 200, {
      ok: true,
      message: "会社別ルールを無効にしました。",
      row,
      item: row
    });

    return true;
  }

  if (
    req.method === "POST" &&
    pathname === "/api/company-transaction-rules/resolve"
  ) {
    const payload = await readJson(req);
    const rows = await companyRuleRepo.resolveRules(payload);

    sendJson(res, 200, {
      ok: true,
      rows,
      items: rows
    });

    return true;
  }

  return false;
}
/* GPT00_COMPANY_TRANSACTION_RULE_API_20260712_END */
async function handleMasterRoutes(req, res) {
  if (
    await handleCompanyTransactionRuleRoutes(req, res)
  ) {
    return true;
  }
  if (await handleBusinessPartnerRoutes(req, res)) {
    return true;
  }
  const clean = normalizeUrl(req.url);
  const parsedForQuery = new URL(req.url, "http://localhost");
  const queryType = parsedForQuery.searchParams.get("type");

  if (req.method === "GET" && clean === "/api/masters" && queryType) {
    const rows = await repo.listMasters(queryType);

    sendJson(res, 200, {
      ok: true,
      type: queryType,
      items: rows,
      rows,
      masters: rows
    });

    return true;
  }

  if (req.method === "GET" && (
    clean === "/api/masters" ||
    clean === "/api/masters/types" ||
    clean === "/api/master" ||
    clean === "/api/master/types"
  )) {
    const types = await repo.listMasterTypes();

    sendJson(res, 200, {
      ok: true,
      types
    });

    return true;
  }

  if (req.method === "GET") {
    const type = parseMasterType(req.url);

    if (type && type !== "types") {
      const rows = await repo.listMasters(type);

      sendJson(res, 200, {
        ok: true,
        type,
        rows,
        masters: rows
      });

      return true;
    }
  }

  if (req.method === "POST" && clean === "/api/masters") {
    const payload = await readJson(req);

    if (payload.type) {
      const row = await repo.createMaster(payload.type, payload);

      sendJson(res, 200, {
        ok: true,
        message: "マスタを追加しました。",
        row,
        item: row
      });

      return true;
    }
  }

  if (req.method === "POST") {
    const type = parseMasterType(req.url);

    if (type) {
      const payload = await readJson(req);
      const row = await repo.createMaster(type, payload);

      sendJson(res, 200, {
        ok: true,
        message: "マスタを追加しました。",
        row
      });

      return true;
    }
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    const target = parseMasterTarget(req.url);

    if (target) {
      const payload = await readJson(req);
      const row = await repo.updateMaster(target.type, target.id, payload);

      sendJson(res, 200, {
        ok: true,
        message: "マスタを更新しました。",
        row
      });

      return true;
    }
  }

  if (req.method === "DELETE") {
    const target = parseMasterTarget(req.url);

    if (target) {
      const row = await repo.disableMaster(target.type, target.id);

      sendJson(res, 200, {
        ok: true,
        message: "マスタを無効化しました。",
        row
      });

      return true;
    }
  }

  return false;
}

module.exports = {
  handleMasterRoutes
};



