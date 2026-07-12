ALTER TABLE sales.products
  ADD COLUMN IF NOT EXISTS company_id BIGINT;

ALTER TABLE sales.customer_prices
  ADD COLUMN IF NOT EXISTS company_id BIGINT;

ALTER TABLE sales.sales_headers
  ADD COLUMN IF NOT EXISTS company_id BIGINT;

ALTER TABLE sales.billing_closes
  ADD COLUMN IF NOT EXISTS company_id BIGINT;

ALTER TABLE sales.invoices
  ADD COLUMN IF NOT EXISTS company_id BIGINT;

ALTER TABLE sales.payments
  ADD COLUMN IF NOT EXISTS company_id BIGINT;

ALTER TABLE sales.access_order_import_queue
  ADD COLUMN IF NOT EXISTS company_id BIGINT;

ALTER TABLE sales.change_logs
  ADD COLUMN IF NOT EXISTS company_id BIGINT;

COMMENT ON COLUMN sales.products.company_id
IS 'この商品を管理する会社ID';

COMMENT ON COLUMN sales.customer_prices.company_id
IS 'この得意先別単価を管理する会社ID';

COMMENT ON COLUMN sales.sales_headers.company_id
IS 'この売上伝票を計上する会社ID';

COMMENT ON COLUMN sales.billing_closes.company_id
IS 'この請求締めを行う会社ID';

COMMENT ON COLUMN sales.invoices.company_id
IS 'この請求書を発行する会社ID';

COMMENT ON COLUMN sales.payments.company_id
IS 'この入金を受け取った会社ID';

COMMENT ON COLUMN sales.access_order_import_queue.company_id
IS 'Access受注を取り込む会社ID';

COMMENT ON COLUMN sales.change_logs.company_id
IS '変更対象データが属する会社ID';

ALTER TABLE sales.products
  DROP CONSTRAINT IF EXISTS products_product_code_key;

DROP INDEX IF EXISTS sales.ux_sales_customer_prices;

CREATE UNIQUE INDEX IF NOT EXISTS
  ux_sales_products_company_code
ON sales.products (
  company_id,
  product_code
)
WHERE company_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
  ux_sales_customer_prices_company
ON sales.customer_prices (
  company_id,
  customer_id,
  product_id,
  effective_from
)
WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  ix_sales_products_company
ON sales.products (company_id);

CREATE INDEX IF NOT EXISTS
  ix_sales_customer_prices_company
ON sales.customer_prices (company_id);

CREATE INDEX IF NOT EXISTS
  ix_sales_headers_company_date
ON sales.sales_headers (
  company_id,
  sales_date
);

CREATE INDEX IF NOT EXISTS
  ix_sales_billing_closes_company
ON sales.billing_closes (
  company_id,
  closing_date
);

CREATE INDEX IF NOT EXISTS
  ix_sales_invoices_company
ON sales.invoices (
  company_id,
  invoice_date
);

CREATE INDEX IF NOT EXISTS
  ix_sales_payments_company
ON sales.payments (
  company_id,
  payment_date
);

CREATE INDEX IF NOT EXISTS
  ix_sales_access_queue_company
ON sales.access_order_import_queue (
  company_id,
  created_at
);

CREATE INDEX IF NOT EXISTS
  ix_sales_change_logs_company
ON sales.change_logs (
  company_id,
  changed_at
);
