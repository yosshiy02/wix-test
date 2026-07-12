const { sendJson, readBody } = require("../response");
const repo = require("./sales.repository");

function parseRequestUrl(url) {
  return new URL(String(url || ""), "http://localhost");
}

async function readJsonBody(req) {
  const raw = await readBody(req);
  if (!String(raw || "").trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("送信されたJSONを読み取れません。");
    error.statusCode = 400;
    throw error;
  }
}

function numericId(pathname, pattern) {
  const match = pathname.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function companyIdFrom(parsed, body = null) {
  const value =
    body && body.company_id != null
      ? body.company_id
      : parsed.searchParams.get("company_id");
  const companyId = Number(value);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    const error = new Error("会社IDは必須です。");
    error.statusCode = 400;
    throw error;
  }
  return companyId;
}

async function handleSalesRoutes(req, res) {
  const parsed = parseRequestUrl(req.url);
  const pathname = parsed.pathname;

  if (req.method === "GET" && pathname === "/api/sales/summary") {
    const companyId = companyIdFrom(parsed);
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      summary: await repo.getSummary(companyId)
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/sales/products") {
    const companyId = companyIdFrom(parsed);
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      products: await repo.listProducts({
        company_id: companyId,
        search: parsed.searchParams.get("search"),
        is_active: parsed.searchParams.get("is_active")
      })
    });
    return true;
  }

  const productId = numericId(pathname, /^\/api\/sales\/products\/(\d+)$/);

  if (req.method === "GET" && productId) {
    const companyId = companyIdFrom(parsed);
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      product: await repo.getProduct(productId, companyId)
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/sales/products") {
    const body = await readJsonBody(req);
    const companyId = companyIdFrom(parsed, body);
    body.company_id = companyId;
    sendJson(res, 201, {
      ok: true,
      company_id: companyId,
      product: await repo.saveProduct(body)
    });
    return true;
  }

  if (req.method === "PUT" && productId) {
    const body = await readJsonBody(req);
    const companyId = companyIdFrom(parsed, body);
    body.company_id = companyId;
    body.product_id = productId;
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      product: await repo.saveProduct(body)
    });
    return true;
  }

  const productActiveId = numericId(
    pathname,
    /^\/api\/sales\/products\/(\d+)\/active$/
  );

  if (req.method === "PATCH" && productActiveId) {
    const body = await readJsonBody(req);
    const companyId = companyIdFrom(parsed, body);
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      product: await repo.setProductActive(
        productActiveId,
        body.is_active,
        companyId
      )
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/sales/customer-prices") {
    const companyId = companyIdFrom(parsed);
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      customer_prices: await repo.listCustomerPrices({
        company_id: companyId,
        customer_id: parsed.searchParams.get("customer_id"),
        product_id: parsed.searchParams.get("product_id")
      })
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/sales/customer-prices") {
    const body = await readJsonBody(req);
    const companyId = companyIdFrom(parsed, body);
    body.company_id = companyId;
    sendJson(res, 201, {
      ok: true,
      company_id: companyId,
      customer_price: await repo.saveCustomerPrice(body)
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/sales/slips") {
    const companyId = companyIdFrom(parsed);
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      sales: await repo.listSales({
        company_id: companyId,
        search: parsed.searchParams.get("search"),
        status: parsed.searchParams.get("status")
      })
    });
    return true;
  }

  const salesId = numericId(pathname, /^\/api\/sales\/slips\/(\d+)$/);

  if (req.method === "GET" && salesId) {
    const companyId = companyIdFrom(parsed);
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      sale: await repo.getSale(salesId, companyId)
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/sales/slips") {
    const body = await readJsonBody(req);
    const companyId = companyIdFrom(parsed, body);
    body.company_id = companyId;
    sendJson(res, 201, {
      ok: true,
      company_id: companyId,
      sale: await repo.createSale(body)
    });
    return true;
  }

  const salesStatusId = numericId(
    pathname,
    /^\/api\/sales\/slips\/(\d+)\/status$/
  );

  if (req.method === "PATCH" && salesStatusId) {
    const body = await readJsonBody(req);
    const companyId = companyIdFrom(parsed, body);
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      sale: await repo.updateSaleStatus(
        salesStatusId,
        body.status,
        companyId
      )
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/sales/billing-closes") {
    const companyId = companyIdFrom(parsed);
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      billing_closes: await repo.listBillingCloses(companyId)
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/sales/billing-closes") {
    const body = await readJsonBody(req);
    const companyId = companyIdFrom(parsed, body);
    body.company_id = companyId;
    sendJson(res, 201, {
      ok: true,
      company_id: companyId,
      billing_close: await repo.createBillingClose(body)
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/sales/invoices") {
    const companyId = companyIdFrom(parsed);
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      invoices: await repo.listInvoices({
        company_id: companyId,
        customer_id: parsed.searchParams.get("customer_id"),
        issue_status: parsed.searchParams.get("issue_status")
      })
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/sales/invoices") {
    const body = await readJsonBody(req);
    const companyId = companyIdFrom(parsed, body);
    body.company_id = companyId;
    sendJson(res, 201, {
      ok: true,
      company_id: companyId,
      invoice: await repo.createInvoice(body)
    });
    return true;
  }

  const invoiceStatusId = numericId(
    pathname,
    /^\/api\/sales\/invoices\/(\d+)\/status$/
  );

  if (req.method === "PATCH" && invoiceStatusId) {
    const body = await readJsonBody(req);
    const companyId = companyIdFrom(parsed, body);
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      invoice: await repo.updateInvoiceStatus(
        invoiceStatusId,
        body.issue_status,
        companyId
      )
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/sales/payments") {
    const companyId = companyIdFrom(parsed);
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      payments: await repo.listPayments({
        company_id: companyId,
        customer_id: parsed.searchParams.get("customer_id")
      })
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/sales/payments") {
    const body = await readJsonBody(req);
    const companyId = companyIdFrom(parsed, body);
    body.company_id = companyId;
    sendJson(res, 201, {
      ok: true,
      company_id: companyId,
      payment: await repo.createPayment(body)
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/sales/payment-allocations") {
    const body = await readJsonBody(req);
    const companyId = companyIdFrom(parsed, body);
    body.company_id = companyId;
    sendJson(res, 201, {
      ok: true,
      company_id: companyId,
      result: await repo.allocatePayment(body)
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/sales/access-order-queue") {
    const companyId = companyIdFrom(parsed);
    sendJson(res, 200, {
      ok: true,
      company_id: companyId,
      queue: await repo.listAccessOrderQueue(companyId)
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/sales/access-order-queue") {
    const body = await readJsonBody(req);
    const companyId = companyIdFrom(parsed, body);
    body.company_id = companyId;
    sendJson(res, 201, {
      ok: true,
      company_id: companyId,
      queue_item: await repo.addAccessOrderQueue(body)
    });
    return true;
  }

  return false;
}

module.exports = {
  handleSalesRoutes
};
