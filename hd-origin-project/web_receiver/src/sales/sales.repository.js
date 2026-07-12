const pool = require("../db");

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function text(value) {
  return String(value == null ? "" : value).trim();
}

function nullableText(value) {
  const result = text(value);
  return result || null;
}

function numberValue(value, defaultValue = 0) {
  if (value === "" || value == null) {
    return defaultValue;
  }

  const result = Number(value);

  if (!Number.isFinite(result)) {
    return defaultValue;
  }

  return result;
}

function nullableNumber(value) {
  if (value === "" || value == null) {
    return null;
  }

  const result = Number(value);

  if (!Number.isFinite(result)) {
    return null;
  }

  return result;
}

function booleanValue(value, defaultValue = true) {
  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }

  if (value === false || value === "false" || value === 0 || value === "0") {
    return false;
  }

  return defaultValue;
}

function dateValue(value) {
  const result = text(value);
  return result || null;
}

function createDocumentNo(prefix) {
  const now = new Date();

  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");

  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
    String(now.getMilliseconds()).padStart(3, "0")
  ].join("");

  const randomPart = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `${prefix}-${datePart}-${timePart}-${randomPart}`;
}

async function addChangeLog(
  client,
  entityType,
  entityId,
  actionType,
  beforeData,
  afterData
) {
  await client.query(
    `
      INSERT INTO sales.change_logs (
        entity_type,
        entity_id,
        action_type,
        before_data,
        after_data
      )
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
    `,
    [
      entityType,
      entityId || null,
      actionType,
      beforeData == null ? null : JSON.stringify(beforeData),
      afterData == null ? null : JSON.stringify(afterData)
    ]
  );
}

async function listProducts(filters = {}) {
  const values = [];
  const where = [];

  if (text(filters.search)) {
    values.push(`%${text(filters.search)}%`);

    where.push(`
      (
        product_code ILIKE $${values.length}
        OR product_name ILIKE $${values.length}
        OR COALESCE(brand_name, '') ILIKE $${values.length}
        OR COALESCE(category_name, '') ILIKE $${values.length}
      )
    `);
  }

  if (
    filters.is_active === true ||
    filters.is_active === false ||
    filters.is_active === "true" ||
    filters.is_active === "false"
  ) {
    values.push(booleanValue(filters.is_active));

    where.push(`is_active = $${values.length}`);
  }

  const sql = `
    SELECT *
    FROM sales.products
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY
      is_active DESC,
      product_code,
      product_id
    LIMIT 1000
  `;

  return (await pool.query(sql, values)).rows;
}

async function getProduct(productId) {
  const result = await pool.query(
    `
      SELECT *
      FROM sales.products
      WHERE product_id = $1
    `,
    [productId]
  );

  if (!result.rowCount) {
    throw createError("商品が見つかりません。", 404);
  }

  return result.rows[0];
}

async function saveProduct(body) {
  const productCode = text(body.product_code);
  const productName = text(body.product_name);

  if (!productCode) {
    throw createError("商品コードは必須です。");
  }

  if (!productName) {
    throw createError("商品名は必須です。");
  }

  const productId = nullableNumber(body.product_id);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let beforeData = null;
    let saved;

    if (productId) {
      const beforeResult = await client.query(
        `
          SELECT *
          FROM sales.products
          WHERE product_id = $1
          FOR UPDATE
        `,
        [productId]
      );

      if (!beforeResult.rowCount) {
        throw createError("更新対象の商品が見つかりません。", 404);
      }

      beforeData = beforeResult.rows[0];

      saved = (
        await client.query(
          `
            UPDATE sales.products
            SET
              product_code = $2,
              product_name = $3,
              brand_name = $4,
              category_name = $5,
              color_name = $6,
              size_name = $7,
              unit_name = $8,
              standard_price = $9,
              standard_cost = $10,
              tax_rate = $11,
              is_active = $12,
              note = $13,
              updated_at = NOW()
            WHERE product_id = $1
            RETURNING *
          `,
          [
            productId,
            productCode,
            productName,
            nullableText(body.brand_name),
            nullableText(body.category_name),
            nullableText(body.color_name),
            nullableText(body.size_name),
            text(body.unit_name) || "足",
            numberValue(body.standard_price),
            numberValue(body.standard_cost),
            numberValue(body.tax_rate, 0.10),
            booleanValue(body.is_active),
            nullableText(body.note)
          ]
        )
      ).rows[0];
    } else {
      saved = (
        await client.query(
          `
            INSERT INTO sales.products (
              product_code,
              product_name,
              brand_name,
              category_name,
              color_name,
              size_name,
              unit_name,
              standard_price,
              standard_cost,
              tax_rate,
              is_active,
              note
            )
            VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11, $12
            )
            RETURNING *
          `,
          [
            productCode,
            productName,
            nullableText(body.brand_name),
            nullableText(body.category_name),
            nullableText(body.color_name),
            nullableText(body.size_name),
            text(body.unit_name) || "足",
            numberValue(body.standard_price),
            numberValue(body.standard_cost),
            numberValue(body.tax_rate, 0.10),
            booleanValue(body.is_active),
            nullableText(body.note)
          ]
        )
      ).rows[0];
    }

    await addChangeLog(
      client,
      "product",
      saved.product_id,
      productId ? "update" : "create",
      beforeData,
      saved
    );

    await client.query("COMMIT");

    return saved;
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createError(
        "同じ商品コードがすでに登録されています。",
        409
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function setProductActive(productId, isActive) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const beforeResult = await client.query(
      `
        SELECT *
        FROM sales.products
        WHERE product_id = $1
        FOR UPDATE
      `,
      [productId]
    );

    if (!beforeResult.rowCount) {
      throw createError("商品が見つかりません。", 404);
    }

    const saved = (
      await client.query(
        `
          UPDATE sales.products
          SET
            is_active = $2,
            updated_at = NOW()
          WHERE product_id = $1
          RETURNING *
        `,
        [productId, booleanValue(isActive)]
      )
    ).rows[0];

    await addChangeLog(
      client,
      "product",
      productId,
      "active_change",
      beforeResult.rows[0],
      saved
    );

    await client.query("COMMIT");

    return saved;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listCustomerPrices(filters = {}) {
  const values = [];
  const where = [];

  if (nullableNumber(filters.customer_id)) {
    values.push(nullableNumber(filters.customer_id));
    where.push(`cp.customer_id = $${values.length}`);
  }

  if (nullableNumber(filters.product_id)) {
    values.push(nullableNumber(filters.product_id));
    where.push(`cp.product_id = $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        cp.*,
        p.product_code,
        p.product_name,
        p.brand_name
      FROM sales.customer_prices cp
      JOIN sales.products p
        ON p.product_id = cp.product_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY
        cp.customer_id,
        p.product_code,
        cp.effective_from DESC NULLS LAST,
        cp.customer_price_id DESC
      LIMIT 2000
    `,
    values
  );

  return result.rows;
}

async function saveCustomerPrice(body) {
  const customerId = nullableNumber(body.customer_id);
  const productId = nullableNumber(body.product_id);

  if (!customerId) {
    throw createError("得意先IDは必須です。");
  }

  if (!productId) {
    throw createError("商品IDは必須です。");
  }

  const customerPriceId =
    nullableNumber(body.customer_price_id);

  if (customerPriceId) {
    const result = await pool.query(
      `
        UPDATE sales.customer_prices
        SET
          customer_id = $2,
          product_id = $3,
          unit_price = $4,
          discount_rate = $5,
          effective_from = $6,
          effective_to = $7,
          is_active = $8,
          note = $9,
          updated_at = NOW()
        WHERE customer_price_id = $1
        RETURNING *
      `,
      [
        customerPriceId,
        customerId,
        productId,
        numberValue(body.unit_price),
        nullableNumber(body.discount_rate),
        dateValue(body.effective_from),
        dateValue(body.effective_to),
        booleanValue(body.is_active),
        nullableText(body.note)
      ]
    );

    if (!result.rowCount) {
      throw createError(
        "得意先別単価が見つかりません。",
        404
      );
    }

    return result.rows[0];
  }

  return (
    await pool.query(
      `
        INSERT INTO sales.customer_prices (
          customer_id,
          product_id,
          unit_price,
          discount_rate,
          effective_from,
          effective_to,
          is_active,
          note
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        customerId,
        productId,
        numberValue(body.unit_price),
        nullableNumber(body.discount_rate),
        dateValue(body.effective_from),
        dateValue(body.effective_to),
        booleanValue(body.is_active),
        nullableText(body.note)
      ]
    )
  ).rows[0];
}

async function listSales(filters = {}) {
  const values = [];
  const where = [];

  if (text(filters.search)) {
    values.push(`%${text(filters.search)}%`);

    where.push(`
      (
        sh.sales_no ILIKE $${values.length}
        OR COALESCE(sh.customer_code, '') ILIKE $${values.length}
        OR sh.customer_name ILIKE $${values.length}
        OR COALESCE(sh.access_order_no, '') ILIKE $${values.length}
      )
    `);
  }

  if (text(filters.status)) {
    values.push(text(filters.status));
    where.push(`sh.status = $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        sh.*,
        sh.total_amount - sh.paid_amount AS receivable_balance,
        COUNT(sl.sales_line_id)::INTEGER AS line_count
      FROM sales.sales_headers sh
      LEFT JOIN sales.sales_lines sl
        ON sl.sales_id = sh.sales_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY sh.sales_id
      ORDER BY
        sh.sales_date DESC,
        sh.sales_id DESC
      LIMIT 1000
    `,
    values
  );

  return result.rows;
}

async function getSale(salesId) {
  const headerResult = await pool.query(
    `
      SELECT
        *,
        total_amount - paid_amount AS receivable_balance
      FROM sales.sales_headers
      WHERE sales_id = $1
    `,
    [salesId]
  );

  if (!headerResult.rowCount) {
    throw createError("売上伝票が見つかりません。", 404);
  }

  const lineResult = await pool.query(
    `
      SELECT *
      FROM sales.sales_lines
      WHERE sales_id = $1
      ORDER BY line_no, sales_line_id
    `,
    [salesId]
  );

  return {
    header: headerResult.rows[0],
    lines: lineResult.rows
  };
}

async function createSale(body) {
  const customerName = text(body.customer_name);
  const sourceLines = Array.isArray(body.lines)
    ? body.lines
    : [];

  if (!customerName) {
    throw createError("得意先名は必須です。");
  }

  if (!sourceLines.length) {
    throw createError("売上明細がありません。");
  }

  const lines = sourceLines.map((line, index) => {
    const productName = text(line.product_name);

    if (!productName) {
      throw createError(
        `売上明細${index + 1}行目の商品名がありません。`
      );
    }

    const quantity = numberValue(line.quantity);
    const unitPrice = numberValue(line.unit_price);
    const taxRate = numberValue(line.tax_rate, 0.10);
    const lineAmount = quantity * unitPrice;

    return {
      line_no: index + 1,
      product_id: nullableNumber(line.product_id),
      product_code: nullableText(line.product_code),
      product_name: productName,
      color_name: nullableText(line.color_name),
      size_name: nullableText(line.size_name),
      quantity,
      unit_name: text(line.unit_name) || "足",
      unit_price: unitPrice,
      line_amount: lineAmount,
      tax_rate: taxRate,
      transaction_type:
        text(line.transaction_type) || "sale",
      note: nullableText(line.note)
    };
  });

  const subtotalAmount = lines.reduce(
    (sum, line) => sum + line.line_amount,
    0
  );

  const taxAmount = lines.reduce(
    (sum, line) =>
      sum + line.line_amount * line.tax_rate,
    0
  );

  const discountAmount =
    numberValue(body.discount_amount);

  const freightAmount =
    numberValue(body.freight_amount);

  const totalAmount =
    subtotalAmount -
    discountAmount +
    freightAmount +
    taxAmount;

  const salesNo =
    text(body.sales_no) ||
    createDocumentNo("SL");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const header = (
      await client.query(
        `
          INSERT INTO sales.sales_headers (
            sales_no,
            order_source,
            access_order_no,
            sales_date,
            shipment_date,
            customer_id,
            customer_code,
            customer_name,
            delivery_name,
            closing_day,
            status,
            subtotal_amount,
            discount_amount,
            freight_amount,
            tax_amount,
            total_amount,
            note
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16, $17
          )
          RETURNING *
        `,
        [
          salesNo,
          text(body.order_source) || "manual",
          nullableText(body.access_order_no),
          dateValue(body.sales_date) ||
            new Date().toISOString().slice(0, 10),
          dateValue(body.shipment_date),
          nullableNumber(body.customer_id),
          nullableText(body.customer_code),
          customerName,
          nullableText(body.delivery_name),
          nullableText(body.closing_day),
          text(body.status) || "draft",
          subtotalAmount,
          discountAmount,
          freightAmount,
          taxAmount,
          totalAmount,
          nullableText(body.note)
        ]
      )
    ).rows[0];

    for (const line of lines) {
      await client.query(
        `
          INSERT INTO sales.sales_lines (
            sales_id,
            line_no,
            product_id,
            product_code,
            product_name,
            color_name,
            size_name,
            quantity,
            unit_name,
            unit_price,
            line_amount,
            tax_rate,
            transaction_type,
            note
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13, $14
          )
        `,
        [
          header.sales_id,
          line.line_no,
          line.product_id,
          line.product_code,
          line.product_name,
          line.color_name,
          line.size_name,
          line.quantity,
          line.unit_name,
          line.unit_price,
          line.line_amount,
          line.tax_rate,
          line.transaction_type,
          line.note
        ]
      );
    }

    await addChangeLog(
      client,
      "sales_slip",
      header.sales_id,
      "create",
      null,
      {
        header,
        lines
      }
    );

    await client.query("COMMIT");

    return await getSale(header.sales_id);
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createError(
        "同じ売上伝票番号がすでに存在します。",
        409
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function updateSaleStatus(salesId, status) {
  const allowed = [
    "draft",
    "confirmed",
    "shipped",
    "billed",
    "partially_paid",
    "paid",
    "returned",
    "cancelled"
  ];

  const normalizedStatus = text(status);

  if (!allowed.includes(normalizedStatus)) {
    throw createError("売上伝票の状態が不正です。");
  }

  const result = await pool.query(
    `
      UPDATE sales.sales_headers
      SET
        status = $2,
        updated_at = NOW()
      WHERE sales_id = $1
      RETURNING *
    `,
    [salesId, normalizedStatus]
  );

  if (!result.rowCount) {
    throw createError("売上伝票が見つかりません。", 404);
  }

  return result.rows[0];
}

async function listBillingCloses() {
  return (
    await pool.query(
      `
        SELECT *
        FROM sales.billing_closes
        ORDER BY
          closing_date DESC,
          billing_close_id DESC
        LIMIT 1000
      `
    )
  ).rows;
}

async function createBillingClose(body) {
  const customerName = text(body.customer_name);

  if (!customerName) {
    throw createError("得意先名は必須です。");
  }

  const previousBalance =
    numberValue(body.previous_balance);

  const salesAmount =
    numberValue(body.sales_amount);

  const paymentAmount =
    numberValue(body.payment_amount);

  const adjustmentAmount =
    numberValue(body.adjustment_amount);

  const currentBalance =
    previousBalance +
    salesAmount -
    paymentAmount +
    adjustmentAmount;

  return (
    await pool.query(
      `
        INSERT INTO sales.billing_closes (
          close_no,
          customer_id,
          customer_name,
          closing_date,
          period_from,
          period_to,
          previous_balance,
          sales_amount,
          payment_amount,
          adjustment_amount,
          current_balance,
          status
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12
        )
        RETURNING *
      `,
      [
        text(body.close_no) ||
          createDocumentNo("CL"),
        nullableNumber(body.customer_id),
        customerName,
        dateValue(body.closing_date) ||
          new Date().toISOString().slice(0, 10),
        dateValue(body.period_from),
        dateValue(body.period_to),
        previousBalance,
        salesAmount,
        paymentAmount,
        adjustmentAmount,
        currentBalance,
        text(body.status) || "closed"
      ]
    )
  ).rows[0];
}

async function listInvoices(filters = {}) {
  const values = [];
  const where = [];

  if (nullableNumber(filters.customer_id)) {
    values.push(nullableNumber(filters.customer_id));
    where.push(`customer_id = $${values.length}`);
  }

  if (text(filters.issue_status)) {
    values.push(text(filters.issue_status));
    where.push(`issue_status = $${values.length}`);
  }

  return (
    await pool.query(
      `
        SELECT *
        FROM sales.invoices
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY
          invoice_date DESC,
          invoice_id DESC
        LIMIT 1000
      `,
      values
    )
  ).rows;
}

async function createInvoice(body) {
  const customerName = text(body.customer_name);

  if (!customerName) {
    throw createError("得意先名は必須です。");
  }

  const subtotalAmount =
    numberValue(body.subtotal_amount);

  const taxAmount =
    numberValue(body.tax_amount);

  const totalAmount =
    body.total_amount === "" ||
    body.total_amount == null
      ? subtotalAmount + taxAmount
      : numberValue(body.total_amount);

  const paidAmount =
    numberValue(body.paid_amount);

  const balanceAmount =
    totalAmount - paidAmount;

  return (
    await pool.query(
      `
        INSERT INTO sales.invoices (
          invoice_no,
          billing_close_id,
          customer_id,
          customer_name,
          invoice_date,
          due_date,
          subtotal_amount,
          tax_amount,
          total_amount,
          paid_amount,
          balance_amount,
          issue_status,
          issued_at,
          note
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14
        )
        RETURNING *
      `,
      [
        text(body.invoice_no) ||
          createDocumentNo("IV"),
        nullableNumber(body.billing_close_id),
        nullableNumber(body.customer_id),
        customerName,
        dateValue(body.invoice_date) ||
          new Date().toISOString().slice(0, 10),
        dateValue(body.due_date),
        subtotalAmount,
        taxAmount,
        totalAmount,
        paidAmount,
        balanceAmount,
        text(body.issue_status) || "draft",
        body.issue_status === "issued"
          ? new Date()
          : null,
        nullableText(body.note)
      ]
    )
  ).rows[0];
}

async function updateInvoiceStatus(invoiceId, issueStatus) {
  const allowed = [
    "draft",
    "issued",
    "reissued",
    "cancelled"
  ];

  const normalizedStatus = text(issueStatus);

  if (!allowed.includes(normalizedStatus)) {
    throw createError("請求書発行状態が不正です。");
  }

  const result = await pool.query(
    `
      UPDATE sales.invoices
      SET
        issue_status = $2,
        issued_at =
          CASE
            WHEN $2 IN ('issued', 'reissued')
              THEN NOW()
            ELSE issued_at
          END,
        updated_at = NOW()
      WHERE invoice_id = $1
      RETURNING *
    `,
    [invoiceId, normalizedStatus]
  );

  if (!result.rowCount) {
    throw createError("請求書が見つかりません。", 404);
  }

  return result.rows[0];
}

async function listPayments(filters = {}) {
  const values = [];
  const where = [];

  if (nullableNumber(filters.customer_id)) {
    values.push(nullableNumber(filters.customer_id));
    where.push(`customer_id = $${values.length}`);
  }

  return (
    await pool.query(
      `
        SELECT *
        FROM sales.payments
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY
          payment_date DESC,
          payment_id DESC
        LIMIT 1000
      `,
      values
    )
  ).rows;
}

async function createPayment(body) {
  const customerName = text(body.customer_name);
  const amount = numberValue(body.amount);

  if (!customerName) {
    throw createError("得意先名は必須です。");
  }

  if (amount <= 0) {
    throw createError("入金額は0円より大きくしてください。");
  }

  return (
    await pool.query(
      `
        INSERT INTO sales.payments (
          payment_no,
          payment_date,
          customer_id,
          customer_name,
          payment_method,
          amount,
          bank_transaction_id,
          unapplied_amount,
          note
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $6, $8
        )
        RETURNING *
      `,
      [
        text(body.payment_no) ||
          createDocumentNo("PM"),
        dateValue(body.payment_date) ||
          new Date().toISOString().slice(0, 10),
        nullableNumber(body.customer_id),
        customerName,
        text(body.payment_method) ||
          "bank_transfer",
        amount,
        nullableNumber(body.bank_transaction_id),
        nullableText(body.note)
      ]
    )
  ).rows[0];
}

async function allocatePayment(body) {
  const paymentId = nullableNumber(body.payment_id);
  const invoiceId = nullableNumber(body.invoice_id);
  const amount = numberValue(body.allocated_amount);

  if (!paymentId || !invoiceId) {
    throw createError(
      "入金IDと請求書IDは必須です。"
    );
  }

  if (amount <= 0) {
    throw createError(
      "消込金額は0円より大きくしてください。"
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const paymentResult = await client.query(
      `
        SELECT *
        FROM sales.payments
        WHERE payment_id = $1
        FOR UPDATE
      `,
      [paymentId]
    );

    const invoiceResult = await client.query(
      `
        SELECT *
        FROM sales.invoices
        WHERE invoice_id = $1
        FOR UPDATE
      `,
      [invoiceId]
    );

    if (!paymentResult.rowCount) {
      throw createError("入金データが見つかりません。", 404);
    }

    if (!invoiceResult.rowCount) {
      throw createError("請求書が見つかりません。", 404);
    }

    const payment = paymentResult.rows[0];
    const invoice = invoiceResult.rows[0];

    const unappliedAmount =
      numberValue(payment.unapplied_amount);

    const balanceAmount =
      numberValue(invoice.balance_amount);

    if (amount > unappliedAmount) {
      throw createError(
        "消込金額が未消込入金額を超えています。"
      );
    }

    if (amount > balanceAmount) {
      throw createError(
        "消込金額が請求残高を超えています。"
      );
    }

    const allocation = (
      await client.query(
        `
          INSERT INTO sales.payment_allocations (
            payment_id,
            invoice_id,
            allocated_amount
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (payment_id, invoice_id)
          DO UPDATE SET
            allocated_amount =
              sales.payment_allocations.allocated_amount +
              EXCLUDED.allocated_amount,
            allocated_at = NOW()
          RETURNING *
        `,
        [paymentId, invoiceId, amount]
      )
    ).rows[0];

    const updatedPayment = (
      await client.query(
        `
          UPDATE sales.payments
          SET unapplied_amount = unapplied_amount - $2
          WHERE payment_id = $1
          RETURNING *
        `,
        [paymentId, amount]
      )
    ).rows[0];

    const updatedInvoice = (
      await client.query(
        `
          UPDATE sales.invoices
          SET
            paid_amount = paid_amount + $2,
            balance_amount = balance_amount - $2,
            updated_at = NOW()
          WHERE invoice_id = $1
          RETURNING *
        `,
        [invoiceId, amount]
      )
    ).rows[0];

    await addChangeLog(
      client,
      "payment_allocation",
      allocation.allocation_id,
      "allocate",
      null,
      {
        allocation,
        payment: updatedPayment,
        invoice: updatedInvoice
      }
    );

    await client.query("COMMIT");

    return {
      allocation,
      payment: updatedPayment,
      invoice: updatedInvoice
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listAccessOrderQueue() {
  return (
    await pool.query(
      `
        SELECT *
        FROM sales.access_order_import_queue
        ORDER BY
          created_at DESC,
          import_queue_id DESC
        LIMIT 1000
      `
    )
  ).rows;
}

async function addAccessOrderQueue(body) {
  return (
    await pool.query(
      `
        INSERT INTO sales.access_order_import_queue (
          source_file_name,
          access_order_no,
          payload,
          import_status
        )
        VALUES ($1, $2, $3::jsonb, 'waiting')
        RETURNING *
      `,
      [
        nullableText(body.source_file_name),
        nullableText(body.access_order_no),
        JSON.stringify(
          body.payload &&
          typeof body.payload === "object"
            ? body.payload
            : {}
        )
      ]
    )
  ).rows[0];
}

async function getSummary() {
  return (
    await pool.query(
      `
        SELECT
          (
            SELECT COUNT(*)
            FROM sales.products
            WHERE is_active = TRUE
          ) AS product_count,

          (
            SELECT COUNT(*)
            FROM sales.sales_headers
          ) AS sales_count,

          (
            SELECT COALESCE(SUM(total_amount), 0)
            FROM sales.sales_headers
            WHERE status <> 'cancelled'
          ) AS sales_total,

          (
            SELECT COUNT(*)
            FROM sales.invoices
            WHERE balance_amount > 0
              AND issue_status <> 'cancelled'
          ) AS open_invoice_count,

          (
            SELECT COALESCE(SUM(balance_amount), 0)
            FROM sales.invoices
            WHERE issue_status <> 'cancelled'
          ) AS receivable_total,

          (
            SELECT COALESCE(SUM(unapplied_amount), 0)
            FROM sales.payments
          ) AS unapplied_payment_total,

          (
            SELECT COUNT(*)
            FROM sales.access_order_import_queue
            WHERE import_status = 'waiting'
          ) AS access_waiting_count
      `
    )
  ).rows[0];
}

module.exports = {
  listProducts,
  getProduct,
  saveProduct,
  setProductActive,
  listCustomerPrices,
  saveCustomerPrice,
  listSales,
  getSale,
  createSale,
  updateSaleStatus,
  listBillingCloses,
  createBillingClose,
  listInvoices,
  createInvoice,
  updateInvoiceStatus,
  listPayments,
  createPayment,
  allocatePayment,
  listAccessOrderQueue,
  addAccessOrderQueue,
  getSummary
};
