CREATE SCHEMA IF NOT EXISTS sales;

CREATE TABLE IF NOT EXISTS sales.products (
  product_id BIGSERIAL PRIMARY KEY,
  product_code TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  brand_name TEXT,
  category_name TEXT,
  color_name TEXT,
  size_name TEXT,
  unit_name TEXT NOT NULL DEFAULT '足',
  standard_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  standard_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0.10,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales.customer_prices (
  customer_price_id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL
    REFERENCES sales.products(product_id),
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_rate NUMERIC(8,4),
  effective_from DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS
  ux_sales_customer_prices
ON sales.customer_prices (
  customer_id,
  product_id,
  effective_from
);

CREATE TABLE IF NOT EXISTS sales.sales_headers (
  sales_id BIGSERIAL PRIMARY KEY,
  sales_no TEXT NOT NULL UNIQUE,
  order_source TEXT,
  access_order_no TEXT,
  sales_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shipment_date DATE,
  customer_id BIGINT,
  customer_code TEXT,
  customer_name TEXT NOT NULL,
  delivery_name TEXT,
  closing_day TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  freight_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  billed_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales.sales_lines (
  sales_line_id BIGSERIAL PRIMARY KEY,
  sales_id BIGINT NOT NULL
    REFERENCES sales.sales_headers(sales_id)
    ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  product_id BIGINT
    REFERENCES sales.products(product_id),
  product_code TEXT,
  product_name TEXT NOT NULL,
  color_name TEXT,
  size_name TEXT,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  unit_name TEXT,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6,4) NOT NULL DEFAULT 0.10,
  transaction_type TEXT NOT NULL DEFAULT 'sale',
  note TEXT,
  UNIQUE (sales_id, line_no)
);

CREATE TABLE IF NOT EXISTS sales.billing_closes (
  billing_close_id BIGSERIAL PRIMARY KEY,
  close_no TEXT NOT NULL UNIQUE,
  customer_id BIGINT,
  customer_name TEXT NOT NULL,
  closing_date DATE NOT NULL,
  period_from DATE,
  period_to DATE,
  previous_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  sales_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  adjustment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'closed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales.invoices (
  invoice_id BIGSERIAL PRIMARY KEY,
  invoice_no TEXT NOT NULL UNIQUE,
  billing_close_id BIGINT
    REFERENCES sales.billing_closes(billing_close_id),
  customer_id BIGINT,
  customer_name TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  issue_status TEXT NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales.payments (
  payment_id BIGSERIAL PRIMARY KEY,
  payment_no TEXT NOT NULL UNIQUE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id BIGINT,
  customer_name TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  bank_transaction_id BIGINT,
  unapplied_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales.payment_allocations (
  allocation_id BIGSERIAL PRIMARY KEY,
  payment_id BIGINT NOT NULL
    REFERENCES sales.payments(payment_id)
    ON DELETE CASCADE,
  invoice_id BIGINT NOT NULL
    REFERENCES sales.invoices(invoice_id),
  allocated_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payment_id, invoice_id)
);

CREATE TABLE IF NOT EXISTS sales.access_order_import_queue (
  import_queue_id BIGSERIAL PRIMARY KEY,
  source_file_name TEXT,
  access_order_no TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  import_status TEXT NOT NULL DEFAULT 'waiting',
  error_message TEXT,
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales.change_logs (
  change_log_id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  action_type TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
  ix_sales_headers_date
ON sales.sales_headers (sales_date);

CREATE INDEX IF NOT EXISTS
  ix_sales_headers_customer
ON sales.sales_headers (customer_id);

CREATE INDEX IF NOT EXISTS
  ix_sales_invoices_customer
ON sales.invoices (customer_id);

CREATE INDEX IF NOT EXISTS
  ix_sales_invoices_balance
ON sales.invoices (balance_amount);

CREATE INDEX IF NOT EXISTS
  ix_sales_payments_customer
ON sales.payments (customer_id);
