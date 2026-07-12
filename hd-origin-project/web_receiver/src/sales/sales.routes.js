const {
  sendJson,
  readBody
} = require("../response");

const repo = require("./sales.repository");

function parseRequestUrl(url) {
  return new URL(
    String(url || ""),
    "http://localhost"
  );
}

async function readJsonBody(req) {
  const raw = await readBody(req);

  if (!String(raw || "").trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error(
      "送信されたJSONを読み取れません。"
    );

    error.statusCode = 400;
    throw error;
  }
}

function numericId(pathname, pattern) {
  const match = pathname.match(pattern);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);

  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

async function handleSalesRoutes(req, res) {
  const parsed = parseRequestUrl(req.url);
  const pathname = parsed.pathname;

  if (
    req.method === "GET" &&
    pathname === "/api/sales/summary"
  ) {
    sendJson(res, 200, {
      ok: true,
      summary: await repo.getSummary()
    });

    return true;
  }

  if (
    req.method === "GET" &&
    pathname === "/api/sales/products"
  ) {
    sendJson(res, 200, {
      ok: true,
      products: await repo.listProducts({
        search: parsed.searchParams.get("search"),
        is_active:
          parsed.searchParams.get("is_active")
      })
    });

    return true;
  }

  const productId = numericId(
    pathname,
    /^\/api\/sales\/products\/(\d+)$/
  );

  if (
    req.method === "GET" &&
    productId
  ) {
    sendJson(res, 200, {
      ok: true,
      product: await repo.getProduct(productId)
    });

    return true;
  }

  if (
    req.method === "POST" &&
    pathname === "/api/sales/products"
  ) {
    sendJson(res, 201, {
      ok: true,
      product:
        await repo.saveProduct(
          await readJsonBody(req)
        )
    });

    return true;
  }

  if (
    req.method === "PUT" &&
    productId
  ) {
    const body = await readJsonBody(req);

    body.product_id = productId;

    sendJson(res, 200, {
      ok: true,
      product: await repo.saveProduct(body)
    });

    return true;
  }

  const productActiveId = numericId(
    pathname,
    /^\/api\/sales\/products\/(\d+)\/active$/
  );

  if (
    req.method === "PATCH" &&
    productActiveId
  ) {
    const body = await readJsonBody(req);

    sendJson(res, 200, {
      ok: true,
      product:
        await repo.setProductActive(
          productActiveId,
          body.is_active
        )
    });

    return true;
  }

  if (
    req.method === "GET" &&
    pathname === "/api/sales/customer-prices"
  ) {
    sendJson(res, 200, {
      ok: true,
      customer_prices:
        await repo.listCustomerPrices({
          customer_id:
            parsed.searchParams.get("customer_id"),
          product_id:
            parsed.searchParams.get("product_id")
        })
    });

    return true;
  }

  if (
    req.method === "POST" &&
    pathname === "/api/sales/customer-prices"
  ) {
    sendJson(res, 201, {
      ok: true,
      customer_price:
        await repo.saveCustomerPrice(
          await readJsonBody(req)
        )
    });

    return true;
  }

  if (
    req.method === "GET" &&
    pathname === "/api/sales/slips"
  ) {
    sendJson(res, 200, {
      ok: true,
      sales:
        await repo.listSales({
          search:
            parsed.searchParams.get("search"),
          status:
            parsed.searchParams.get("status")
        })
    });

    return true;
  }

  const salesId = numericId(
    pathname,
    /^\/api\/sales\/slips\/(\d+)$/
  );

  if (
    req.method === "GET" &&
    salesId
  ) {
    sendJson(res, 200, {
      ok: true,
      sale: await repo.getSale(salesId)
    });

    return true;
  }

  if (
    req.method === "POST" &&
    pathname === "/api/sales/slips"
  ) {
    sendJson(res, 201, {
      ok: true,
      sale:
        await repo.createSale(
          await readJsonBody(req)
        )
    });

    return true;
  }

  const salesStatusId = numericId(
    pathname,
    /^\/api\/sales\/slips\/(\d+)\/status$/
  );

  if (
    req.method === "PATCH" &&
    salesStatusId
  ) {
    const body = await readJsonBody(req);

    sendJson(res, 200, {
      ok: true,
      sale:
        await repo.updateSaleStatus(
          salesStatusId,
          body.status
        )
    });

    return true;
  }

  if (
    req.method === "GET" &&
    pathname === "/api/sales/billing-closes"
  ) {
    sendJson(res, 200, {
      ok: true,
      billing_closes:
        await repo.listBillingCloses()
    });

    return true;
  }

  if (
    req.method === "POST" &&
    pathname === "/api/sales/billing-closes"
  ) {
    sendJson(res, 201, {
      ok: true,
      billing_close:
        await repo.createBillingClose(
          await readJsonBody(req)
        )
    });

    return true;
  }

  if (
    req.method === "GET" &&
    pathname === "/api/sales/invoices"
  ) {
    sendJson(res, 200, {
      ok: true,
      invoices:
        await repo.listInvoices({
          customer_id:
            parsed.searchParams.get("customer_id"),
          issue_status:
            parsed.searchParams.get("issue_status")
        })
    });

    return true;
  }

  if (
    req.method === "POST" &&
    pathname === "/api/sales/invoices"
  ) {
    sendJson(res, 201, {
      ok: true,
      invoice:
        await repo.createInvoice(
          await readJsonBody(req)
        )
    });

    return true;
  }

  const invoiceStatusId = numericId(
    pathname,
    /^\/api\/sales\/invoices\/(\d+)\/status$/
  );

  if (
    req.method === "PATCH" &&
    invoiceStatusId
  ) {
    const body = await readJsonBody(req);

    sendJson(res, 200, {
      ok: true,
      invoice:
        await repo.updateInvoiceStatus(
          invoiceStatusId,
          body.issue_status
        )
    });

    return true;
  }

  if (
    req.method === "GET" &&
    pathname === "/api/sales/payments"
  ) {
    sendJson(res, 200, {
      ok: true,
      payments:
        await repo.listPayments({
          customer_id:
            parsed.searchParams.get("customer_id")
        })
    });

    return true;
  }

  if (
    req.method === "POST" &&
    pathname === "/api/sales/payments"
  ) {
    sendJson(res, 201, {
      ok: true,
      payment:
        await repo.createPayment(
          await readJsonBody(req)
        )
    });

    return true;
  }

  if (
    req.method === "POST" &&
    pathname === "/api/sales/payment-allocations"
  ) {
    sendJson(res, 201, {
      ok: true,
      result:
        await repo.allocatePayment(
          await readJsonBody(req)
        )
    });

    return true;
  }

  if (
    req.method === "GET" &&
    pathname === "/api/sales/access-order-queue"
  ) {
    sendJson(res, 200, {
      ok: true,
      queue:
        await repo.listAccessOrderQueue()
    });

    return true;
  }

  if (
    req.method === "POST" &&
    pathname === "/api/sales/access-order-queue"
  ) {
    sendJson(res, 201, {
      ok: true,
      queue_item:
        await repo.addAccessOrderQueue(
          await readJsonBody(req)
        )
    });

    return true;
  }

  return false;
}

module.exports = {
  handleSalesRoutes
};
