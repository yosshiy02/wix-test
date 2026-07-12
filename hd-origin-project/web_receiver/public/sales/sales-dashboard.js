"use strict";

/* GPT00_SALES_COMPANY_SCOPE_JS_20260712_START */
let activeCompany = null;

function currentCompany() {
  const companyId = Number(
    localStorage.getItem("current_company_id")
  );

  const companyName =
    localStorage.getItem("current_company_name") || "";

  if (!Number.isInteger(companyId) || companyId <= 0) {
    return null;
  }

  return {
    company_id: companyId,
    company_name: companyName
  };
}

function addCompanyBanner(company) {
  const hero = document.querySelector(".hero");

  if (!hero) {
    return;
  }

  let banner =
    document.getElementById("salesCurrentCompany");

  if (!banner) {
    banner = document.createElement("section");
    banner.id = "salesCurrentCompany";
    banner.className = "company-banner";

    hero.insertAdjacentElement(
      "afterend",
      banner
    );
  }

  banner.innerHTML =
    "<strong>現在の会社：</strong>" +
    escapeHtml(
      company.company_name || "会社名未設定"
    );
}

function salesApiUrl(url) {
  const parsed =
    new URL(url, location.origin);

  parsed.searchParams.set(
    "company_id",
    activeCompany.company_id
  );

  return (
    parsed.pathname +
    parsed.search +
    parsed.hash
  );
}
/* GPT00_SALES_COMPANY_SCOPE_JS_20260712_END */

const state = {
  products: [],
  customerPrices: [],
  sales: [],
  billingCloses: [],
  invoices: [],
  payments: [],
  accessQueue: []
};

function element(id) {
  return document.getElementById(id);
}

function text(value) {
  return value == null ? "" : String(value);
}

function escapeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function numberValue(value) {
  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

function formatNumber(value) {
  return numberValue(value).toLocaleString("ja-JP");
}

function formatMoney(value) {
  return `${formatNumber(value)}円`;
}

function localDateString() {
  const now = new Date();

  const year = now.getFullYear();
  const month =
    String(now.getMonth() + 1).padStart(2, "0");
  const day =
    String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function showMessage(message, type = "ok") {
  const box = element("message");

  box.textContent = message;
  box.className = `message show ${type}`;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function hideMessage() {
  const box = element("message");

  box.textContent = "";
  box.className = "message";
}

async function requestJson(url, options = {}) {
  if (!activeCompany) {
    throw new Error(
      "メイン画面で会社を選択してください。"
    );
  }

  const normalizedOptions = {
    ...options
  };

  const method = String(
    normalizedOptions.method || "GET"
  ).toUpperCase();

  if (
    method !== "GET" &&
    method !== "HEAD"
  ) {
    let requestBody = {};

    if (
      typeof normalizedOptions.body === "string" &&
      normalizedOptions.body.trim()
    ) {
      requestBody =
        JSON.parse(normalizedOptions.body);
    } else if (
      normalizedOptions.body &&
      typeof normalizedOptions.body === "object"
    ) {
      requestBody = {
        ...normalizedOptions.body
      };
    }

    requestBody.company_id =
      activeCompany.company_id;

    normalizedOptions.body =
      JSON.stringify(requestBody);
  }

  const response = await fetch(
    salesApiUrl(url),
    {
      cache: "no-store",
      ...normalizedOptions,
      headers: {
        "Content-Type": "application/json",
        ...(normalizedOptions.headers || {})
      }
    }
  );

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `API応答を読み取れません: ${response.status}`
    );
  }

  if (!response.ok || data.ok === false) {
    throw new Error(
      data.error ||
      data.message ||
      `APIエラー: ${response.status}`
    );
  }

  return data;
}

function formValue(id) {
  return element(id).value;
}

function nullableNumber(id) {
  const value = formValue(id);

  if (value === "") {
    return null;
  }

  return Number(value);
}

function booleanValue(id) {
  return formValue(id) === "true";
}

async function loadSummary() {
  const data =
    await requestJson("/api/sales/summary");

  const summary = data.summary || {};

  element("summaryProductCount").textContent =
    formatNumber(summary.product_count);

  element("summarySalesCount").textContent =
    formatNumber(summary.sales_count);

  element("summarySalesTotal").textContent =
    formatMoney(summary.sales_total);

  element("summaryReceivableTotal").textContent =
    formatMoney(summary.receivable_total);

  element("summaryUnappliedTotal").textContent =
    formatMoney(summary.unapplied_payment_total);

  element("summaryAccessWaiting").textContent =
    formatNumber(summary.access_waiting_count);
}

async function loadProducts() {
  const params = new URLSearchParams();

  const search = formValue("productSearch");
  const status = formValue("productStatusFilter");

  if (search) {
    params.set("search", search);
  }

  if (status) {
    params.set("is_active", status);
  }

  const query = params.toString();
  const data = await requestJson(
    `/api/sales/products${query ? `?${query}` : ""}`
  );

  state.products = data.products || [];

  renderProducts();
  renderProductOptions();
}

function renderProducts() {
  const rows = element("productRows");

  if (!state.products.length) {
    rows.innerHTML = `
      <tr>
        <td class="empty" colspan="9">
          商品はまだ登録されていません。
        </td>
      </tr>
    `;

    return;
  }

  rows.innerHTML = state.products
    .map(product => `
      <tr>
        <td>
          <div class="row-actions">
            <button
              class="row-button"
              type="button"
              onclick="editProduct(${product.product_id})"
            >
              編集
            </button>

            <button
              class="row-button"
              type="button"
              onclick="toggleProductActive(
                ${product.product_id},
                ${product.is_active ? "false" : "true"}
              )"
            >
              ${product.is_active ? "停止" : "再開"}
            </button>
          </div>
        </td>

        <td>${escapeHtml(product.product_code)}</td>
        <td>${escapeHtml(product.product_name)}</td>
        <td>${escapeHtml(product.brand_name)}</td>
        <td>${escapeHtml(product.color_name)}</td>
        <td>${escapeHtml(product.size_name)}</td>
        <td>${formatMoney(product.standard_price)}</td>
        <td>${formatMoney(product.standard_cost)}</td>

        <td class="${
          product.is_active
            ? "status-on"
            : "status-off"
        }">
          ${product.is_active ? "有効" : "使用停止"}
        </td>
      </tr>
    `)
    .join("");
}

function renderProductOptions() {
  const options = [
    '<option value="">商品を選択</option>',
    ...state.products
      .filter(product => product.is_active)
      .map(product => `
        <option
          value="${product.product_id}"
          data-code="${escapeHtml(product.product_code)}"
          data-name="${escapeHtml(product.product_name)}"
          data-price="${numberValue(product.standard_price)}"
        >
          ${escapeHtml(product.product_code)}
          /
          ${escapeHtml(product.product_name)}
        </option>
      `)
  ].join("");

  element("price_product_id").innerHTML = options;
  element("sales_product_id").innerHTML = options;
}

window.editProduct = function editProduct(productId) {
  const product = state.products.find(
    item => Number(item.product_id) === Number(productId)
  );

  if (!product) {
    return;
  }

  element("product_id").value =
    product.product_id;

  element("product_code").value =
    text(product.product_code);

  element("product_name").value =
    text(product.product_name);

  element("brand_name").value =
    text(product.brand_name);

  element("category_name").value =
    text(product.category_name);

  element("color_name").value =
    text(product.color_name);

  element("size_name").value =
    text(product.size_name);

  element("unit_name").value =
    text(product.unit_name || "足");

  element("standard_price").value =
    numberValue(product.standard_price);

  element("standard_cost").value =
    numberValue(product.standard_cost);

  element("tax_rate").value =
    text(product.tax_rate || "0.10");

  element("product_is_active").value =
    product.is_active ? "true" : "false";

  element("product_note").value =
    text(product.note);

  location.hash = "products";
};

window.toggleProductActive =
async function toggleProductActive(
  productId,
  isActive
) {
  try {
    hideMessage();

    await requestJson(
      `/api/sales/products/${productId}/active`,
      {
        method: "PATCH",
        body: JSON.stringify({
          is_active: isActive
        })
      }
    );

    showMessage(
      isActive
        ? "商品を有効へ戻しました。"
        : "商品を使用停止にしました。"
    );

    await Promise.all([
      loadProducts(),
      loadSummary()
    ]);
  } catch (error) {
    showMessage(error.message, "error");
  }
};

function clearProductForm() {
  element("productForm").reset();
  element("product_id").value = "";
  element("unit_name").value = "足";
  element("standard_price").value = "0";
  element("standard_cost").value = "0";
  element("tax_rate").value = "0.10";
  element("product_is_active").value = "true";
}

async function saveProduct(event) {
  event.preventDefault();

  try {
    hideMessage();

    const productId =
      nullableNumber("product_id");

    const body = {
      product_id: productId,
      product_code:
        formValue("product_code"),
      product_name:
        formValue("product_name"),
      brand_name:
        formValue("brand_name"),
      category_name:
        formValue("category_name"),
      color_name:
        formValue("color_name"),
      size_name:
        formValue("size_name"),
      unit_name:
        formValue("unit_name"),
      standard_price:
        formValue("standard_price"),
      standard_cost:
        formValue("standard_cost"),
      tax_rate:
        formValue("tax_rate"),
      is_active:
        booleanValue("product_is_active"),
      note:
        formValue("product_note")
    };

    await requestJson(
      productId
        ? `/api/sales/products/${productId}`
        : "/api/sales/products",
      {
        method: productId ? "PUT" : "POST",
        body: JSON.stringify(body)
      }
    );

    clearProductForm();

    showMessage(
      productId
        ? "商品を更新しました。"
        : "商品を登録しました。"
    );

    await Promise.all([
      loadProducts(),
      loadCustomerPrices(),
      loadSummary()
    ]);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadCustomerPrices() {
  const data =
    await requestJson(
      "/api/sales/customer-prices"
    );

  state.customerPrices =
    data.customer_prices || [];

  const rows =
    element("customerPriceRows");

  if (!state.customerPrices.length) {
    rows.innerHTML = `
      <tr>
        <td class="empty" colspan="8">
          得意先別単価はまだありません。
        </td>
      </tr>
    `;

    return;
  }

  rows.innerHTML = state.customerPrices
    .map(item => `
      <tr>
        <td>${escapeHtml(item.customer_id)}</td>
        <td>${escapeHtml(item.product_code)}</td>
        <td>${escapeHtml(item.product_name)}</td>
        <td>${formatMoney(item.unit_price)}</td>
        <td>${escapeHtml(item.discount_rate)}</td>
        <td>${escapeHtml(item.effective_from)}</td>
        <td>${escapeHtml(item.effective_to)}</td>

        <td class="${
          item.is_active
            ? "status-on"
            : "status-off"
        }">
          ${item.is_active ? "有効" : "使用停止"}
        </td>
      </tr>
    `)
    .join("");
}

async function saveCustomerPrice(event) {
  event.preventDefault();

  try {
    hideMessage();

    await requestJson(
      "/api/sales/customer-prices",
      {
        method: "POST",
        body: JSON.stringify({
          customer_price_id:
            nullableNumber("customer_price_id"),
          customer_id:
            nullableNumber("price_customer_id"),
          product_id:
            nullableNumber("price_product_id"),
          unit_price:
            formValue("price_unit_price"),
          discount_rate:
            formValue("price_discount_rate"),
          effective_from:
            formValue("price_effective_from"),
          effective_to:
            formValue("price_effective_to"),
          is_active:
            booleanValue("price_is_active"),
          note:
            formValue("price_note")
        })
      }
    );

    element("customerPriceForm").reset();
    element("price_is_active").value = "true";

    showMessage(
      "得意先別単価を保存しました。"
    );

    await loadCustomerPrices();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadSales() {
  const params = new URLSearchParams();

  const search = formValue("salesSearch");
  const status =
    formValue("salesStatusFilter");

  if (search) {
    params.set("search", search);
  }

  if (status) {
    params.set("status", status);
  }

  const query = params.toString();

  const data = await requestJson(
    `/api/sales/slips${query ? `?${query}` : ""}`
  );

  state.sales = data.sales || [];

  const rows = element("salesRows");

  if (!state.sales.length) {
    rows.innerHTML = `
      <tr>
        <td class="empty" colspan="9">
          売上伝票はまだありません。
        </td>
      </tr>
    `;

    return;
  }

  rows.innerHTML = state.sales
    .map(item => `
      <tr>
        <td>${escapeHtml(item.sales_no)}</td>
        <td>${escapeHtml(item.sales_date)}</td>
        <td>${escapeHtml(item.customer_name)}</td>
        <td>${escapeHtml(item.status)}</td>
        <td>${formatNumber(item.line_count)}</td>
        <td>${formatMoney(item.subtotal_amount)}</td>
        <td>${formatMoney(item.tax_amount)}</td>
        <td>${formatMoney(item.total_amount)}</td>
        <td>${formatMoney(item.receivable_balance)}</td>
      </tr>
    `)
    .join("");
}

async function saveSale(event) {
  event.preventDefault();

  try {
    hideMessage();

    await requestJson(
      "/api/sales/slips",
      {
        method: "POST",
        body: JSON.stringify({
          sales_date:
            formValue("sales_date"),
          customer_id:
            nullableNumber("sales_customer_id"),
          customer_code:
            formValue("sales_customer_code"),
          customer_name:
            formValue("sales_customer_name"),
          status:
            formValue("sales_status"),
          discount_amount:
            formValue("sales_discount_amount"),
          freight_amount:
            formValue("sales_freight_amount"),
          note:
            formValue("sales_note"),
          lines: [
            {
              product_id:
                nullableNumber("sales_product_id"),
              product_code:
                formValue("sales_product_code"),
              product_name:
                formValue("sales_product_name"),
              quantity:
                formValue("sales_quantity"),
              unit_name: "足",
              unit_price:
                formValue("sales_unit_price"),
              tax_rate:
                formValue("sales_line_tax_rate"),
              transaction_type:
                formValue("sales_transaction_type")
            }
          ]
        })
      }
    );

    element("salesForm").reset();
    element("sales_date").value =
      localDateString();

    element("sales_quantity").value = "1";
    element("sales_unit_price").value = "0";
    element("sales_discount_amount").value = "0";
    element("sales_freight_amount").value = "0";

    showMessage("売上伝票を登録しました。");

    await Promise.all([
      loadSales(),
      loadSummary()
    ]);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadBillingCloses() {
  const data = await requestJson(
    "/api/sales/billing-closes"
  );

  state.billingCloses =
    data.billing_closes || [];

  const rows =
    element("billingCloseRows");

  if (!state.billingCloses.length) {
    rows.innerHTML = `
      <tr>
        <td class="empty" colspan="8">
          請求締めデータはまだありません。
        </td>
      </tr>
    `;

    return;
  }

  rows.innerHTML = state.billingCloses
    .map(item => `
      <tr>
        <td>${escapeHtml(item.close_no)}</td>
        <td>${escapeHtml(item.customer_name)}</td>
        <td>${escapeHtml(item.closing_date)}</td>
        <td>
          ${escapeHtml(item.period_from)}
          ～
          ${escapeHtml(item.period_to)}
        </td>
        <td>${formatMoney(item.previous_balance)}</td>
        <td>${formatMoney(item.sales_amount)}</td>
        <td>${formatMoney(item.payment_amount)}</td>
        <td>${formatMoney(item.current_balance)}</td>
      </tr>
    `)
    .join("");
}

async function saveBillingClose(event) {
  event.preventDefault();

  try {
    hideMessage();

    await requestJson(
      "/api/sales/billing-closes",
      {
        method: "POST",
        body: JSON.stringify({
          customer_id:
            nullableNumber("close_customer_id"),
          customer_name:
            formValue("close_customer_name"),
          closing_date:
            formValue("closing_date"),
          period_from:
            formValue("period_from"),
          period_to:
            formValue("period_to"),
          previous_balance:
            formValue("previous_balance"),
          sales_amount:
            formValue("close_sales_amount"),
          payment_amount:
            formValue("close_payment_amount"),
          adjustment_amount:
            formValue("adjustment_amount")
        })
      }
    );

    element("billingCloseForm").reset();
    element("closing_date").value =
      localDateString();

    showMessage("請求締めを登録しました。");

    await loadBillingCloses();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadInvoices() {
  const data =
    await requestJson("/api/sales/invoices");

  state.invoices = data.invoices || [];

  const rows = element("invoiceRows");

  if (!state.invoices.length) {
    rows.innerHTML = `
      <tr>
        <td class="empty" colspan="8">
          請求書はまだありません。
        </td>
      </tr>
    `;

    renderAllocationOptions();
    return;
  }

  rows.innerHTML = state.invoices
    .map(item => `
      <tr>
        <td>${escapeHtml(item.invoice_no)}</td>
        <td>${escapeHtml(item.customer_name)}</td>
        <td>${escapeHtml(item.invoice_date)}</td>
        <td>${escapeHtml(item.due_date)}</td>
        <td>${escapeHtml(item.issue_status)}</td>
        <td>${formatMoney(item.total_amount)}</td>
        <td>${formatMoney(item.paid_amount)}</td>
        <td>${formatMoney(item.balance_amount)}</td>
      </tr>
    `)
    .join("");

  renderAllocationOptions();
}

async function saveInvoice(event) {
  event.preventDefault();

  try {
    hideMessage();

    await requestJson(
      "/api/sales/invoices",
      {
        method: "POST",
        body: JSON.stringify({
          customer_id:
            nullableNumber("invoice_customer_id"),
          customer_name:
            formValue("invoice_customer_name"),
          invoice_date:
            formValue("invoice_date"),
          due_date:
            formValue("due_date"),
          subtotal_amount:
            formValue("invoice_subtotal_amount"),
          tax_amount:
            formValue("invoice_tax_amount"),
          issue_status:
            formValue("invoice_issue_status"),
          note:
            formValue("invoice_note")
        })
      }
    );

    element("invoiceForm").reset();
    element("invoice_date").value =
      localDateString();

    showMessage("請求書を登録しました。");

    await Promise.all([
      loadInvoices(),
      loadSummary()
    ]);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadPayments() {
  const data =
    await requestJson("/api/sales/payments");

  state.payments = data.payments || [];

  const rows = element("paymentRows");

  if (!state.payments.length) {
    rows.innerHTML = `
      <tr>
        <td class="empty" colspan="6">
          入金はまだ登録されていません。
        </td>
      </tr>
    `;

    renderAllocationOptions();
    return;
  }

  rows.innerHTML = state.payments
    .map(item => `
      <tr>
        <td>${escapeHtml(item.payment_no)}</td>
        <td>${escapeHtml(item.payment_date)}</td>
        <td>${escapeHtml(item.customer_name)}</td>
        <td>${escapeHtml(item.payment_method)}</td>
        <td>${formatMoney(item.amount)}</td>
        <td>${formatMoney(item.unapplied_amount)}</td>
      </tr>
    `)
    .join("");

  renderAllocationOptions();
}

async function savePayment(event) {
  event.preventDefault();

  try {
    hideMessage();

    await requestJson(
      "/api/sales/payments",
      {
        method: "POST",
        body: JSON.stringify({
          payment_date:
            formValue("payment_date"),
          customer_id:
            nullableNumber("payment_customer_id"),
          customer_name:
            formValue("payment_customer_name"),
          payment_method:
            formValue("payment_method"),
          amount:
            formValue("payment_amount"),
          note:
            formValue("payment_note")
        })
      }
    );

    element("paymentForm").reset();
    element("payment_date").value =
      localDateString();

    showMessage("入金を登録しました。");

    await Promise.all([
      loadPayments(),
      loadSummary()
    ]);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function renderAllocationOptions() {
  element("allocation_payment_id").innerHTML = [
    '<option value="">未消込入金を選択</option>',
    ...state.payments
      .filter(
        item =>
          numberValue(item.unapplied_amount) > 0
      )
      .map(item => `
        <option value="${item.payment_id}">
          ${escapeHtml(item.payment_no)}
          /
          ${escapeHtml(item.customer_name)}
          /
          未消込 ${formatMoney(item.unapplied_amount)}
        </option>
      `)
  ].join("");

  element("allocation_invoice_id").innerHTML = [
    '<option value="">未回収請求書を選択</option>',
    ...state.invoices
      .filter(
        item =>
          numberValue(item.balance_amount) > 0 &&
          item.issue_status !== "cancelled"
      )
      .map(item => `
        <option value="${item.invoice_id}">
          ${escapeHtml(item.invoice_no)}
          /
          ${escapeHtml(item.customer_name)}
          /
          残高 ${formatMoney(item.balance_amount)}
        </option>
      `)
  ].join("");
}

async function saveAllocation(event) {
  event.preventDefault();

  try {
    hideMessage();

    await requestJson(
      "/api/sales/payment-allocations",
      {
        method: "POST",
        body: JSON.stringify({
          payment_id:
            nullableNumber("allocation_payment_id"),
          invoice_id:
            nullableNumber("allocation_invoice_id"),
          allocated_amount:
            formValue("allocated_amount")
        })
      }
    );

    element("allocationForm").reset();

    showMessage("入金を請求書へ消し込みました。");

    await Promise.all([
      loadPayments(),
      loadInvoices(),
      loadSummary()
    ]);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadAccessQueue() {
  const data = await requestJson(
    "/api/sales/access-order-queue"
  );

  state.accessQueue = data.queue || [];

  const rows =
    element("accessOrderRows");

  if (!state.accessQueue.length) {
    rows.innerHTML = `
      <tr>
        <td class="empty" colspan="6">
          Access受注取込待ちはありません。
        </td>
      </tr>
    `;

    return;
  }

  rows.innerHTML = state.accessQueue
    .map(item => `
      <tr>
        <td>${escapeHtml(item.import_queue_id)}</td>
        <td>${escapeHtml(item.access_order_no)}</td>
        <td>${escapeHtml(item.source_file_name)}</td>
        <td>${escapeHtml(item.import_status)}</td>
        <td>${escapeHtml(item.created_at)}</td>
        <td>${escapeHtml(item.error_message)}</td>
      </tr>
    `)
    .join("");
}

async function saveAccessOrder(event) {
  event.preventDefault();

  try {
    hideMessage();

    let payload = {};
    const rawPayload =
      formValue("access_payload").trim();

    if (rawPayload) {
      try {
        payload = JSON.parse(rawPayload);
      } catch {
        throw new Error(
          "受注データJSONの形式が正しくありません。"
        );
      }
    }

    await requestJson(
      "/api/sales/access-order-queue",
      {
        method: "POST",
        body: JSON.stringify({
          source_file_name:
            formValue("source_file_name"),
          access_order_no:
            formValue("access_order_no"),
          payload
        })
      }
    );

    element("accessOrderForm").reset();

    showMessage(
      "Access受注データを取込待ちへ登録しました。"
    );

    await Promise.all([
      loadAccessQueue(),
      loadSummary()
    ]);
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function loadAll() {
  try {
    hideMessage();

    await loadProducts();

    await Promise.all([
      loadSummary(),
      loadCustomerPrices(),
      loadSales(),
      loadBillingCloses(),
      loadInvoices(),
      loadPayments(),
      loadAccessQueue()
    ]);
  } catch (error) {
    showMessage(
      `販売管理の読込に失敗しました。\n${error.message}`,
      "error"
    );
  }
}

function bindEvents() {
  element("productForm")
    .addEventListener(
      "submit",
      saveProduct
    );

  element("clearProductButton")
    .addEventListener(
      "click",
      clearProductForm
    );

  element("reloadProductsButton")
    .addEventListener(
      "click",
      async () => {
        try {
          await loadProducts();
        } catch (error) {
          showMessage(error.message, "error");
        }
      }
    );

  element("productSearch")
    .addEventListener(
      "change",
      loadProducts
    );

  element("productStatusFilter")
    .addEventListener(
      "change",
      loadProducts
    );

  element("customerPriceForm")
    .addEventListener(
      "submit",
      saveCustomerPrice
    );

  element("salesForm")
    .addEventListener(
      "submit",
      saveSale
    );

  element("reloadSalesButton")
    .addEventListener(
      "click",
      loadSales
    );

  element("salesSearch")
    .addEventListener(
      "change",
      loadSales
    );

  element("salesStatusFilter")
    .addEventListener(
      "change",
      loadSales
    );

  element("billingCloseForm")
    .addEventListener(
      "submit",
      saveBillingClose
    );

  element("invoiceForm")
    .addEventListener(
      "submit",
      saveInvoice
    );

  element("paymentForm")
    .addEventListener(
      "submit",
      savePayment
    );

  element("allocationForm")
    .addEventListener(
      "submit",
      saveAllocation
    );

  element("accessOrderForm")
    .addEventListener(
      "submit",
      saveAccessOrder
    );

  element("reloadAllButton")
    .addEventListener(
      "click",
      loadAll
    );

  element("sales_product_id")
    .addEventListener(
      "change",
      event => {
        const option =
          event.target.selectedOptions[0];

        if (!option || !option.value) {
          return;
        }

        element("sales_product_code").value =
          option.dataset.code || "";

        element("sales_product_name").value =
          option.dataset.name || "";

        element("sales_unit_price").value =
          option.dataset.price || "0";
      }
    );
}

function setInitialDates() {
  const today = localDateString();

  element("sales_date").value = today;
  element("closing_date").value = today;
  element("invoice_date").value = today;
  element("payment_date").value = today;
}

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    activeCompany = currentCompany();

    if (!activeCompany) {
      alert(
        "メイン画面で会社を選択してください。"
      );

      location.href = "/";
      return;
    }

    addCompanyBanner(activeCompany);
    bindEvents();
    setInitialDates();
    await loadAll();
  }
);
