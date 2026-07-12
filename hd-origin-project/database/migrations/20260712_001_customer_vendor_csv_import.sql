BEGIN;

CREATE SCHEMA IF NOT EXISTS expenses;

CREATE TABLE IF NOT EXISTS expenses.customers (
  customer_id BIGSERIAL PRIMARY KEY,
  customer_code TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_name_kana TEXT,
  customer_type TEXT,
  corporate_number TEXT,
  invoice_registration_number TEXT,
  postal_code TEXT,
  address TEXT,
  phone TEXT,
  fax TEXT,
  email TEXT,
  contact_person TEXT,
  closing_day TEXT,
  payment_day TEXT,
  payment_terms TEXT,
  invoice_delivery_method TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expenses.customers
  ADD COLUMN IF NOT EXISTS customer_code TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_name_kana TEXT,
  ADD COLUMN IF NOT EXISTS customer_type TEXT,
  ADD COLUMN IF NOT EXISTS corporate_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS fax TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS closing_day TEXT,
  ADD COLUMN IF NOT EXISTS payment_day TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS invoice_delivery_method TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_customer_code
ON expenses.customers (LOWER(customer_code));

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_corporate_number
ON expenses.customers (corporate_number)
WHERE NULLIF(BTRIM(corporate_number), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_invoice_registration_number
ON expenses.customers (UPPER(invoice_registration_number))
WHERE NULLIF(BTRIM(invoice_registration_number), '') IS NOT NULL;

ALTER TABLE expenses.vendors
  ADD COLUMN IF NOT EXISTS vendor_code TEXT,
  ADD COLUMN IF NOT EXISTS vendor_name_kana TEXT,
  ADD COLUMN IF NOT EXISTS vendor_type TEXT,
  ADD COLUMN IF NOT EXISTS corporate_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS fax TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS closing_day TEXT,
  ADD COLUMN IF NOT EXISTS payment_day TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS ux_vendors_vendor_code
ON expenses.vendors (LOWER(vendor_code))
WHERE NULLIF(BTRIM(vendor_code), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vendors_corporate_number
ON expenses.vendors (corporate_number)
WHERE NULLIF(BTRIM(corporate_number), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vendors_invoice_registration_number
ON expenses.vendors (UPPER(invoice_registration_number))
WHERE NULLIF(BTRIM(invoice_registration_number), '') IS NOT NULL;

CREATE TABLE IF NOT EXISTS expenses.vendor_bank_accounts (
  vendor_bank_account_id BIGSERIAL PRIMARY KEY,
  vendor_id BIGINT NOT NULL
    REFERENCES expenses.vendors(vendor_id)
    ON DELETE CASCADE,
  bank_name TEXT NOT NULL DEFAULT '',
  branch_name TEXT NOT NULL DEFAULT '',
  account_type TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  account_holder TEXT NOT NULL DEFAULT '',
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_vendor_bank_accounts_vendor_id
ON expenses.vendor_bank_accounts(vendor_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_vendor_primary_bank_account
ON expenses.vendor_bank_accounts(vendor_id)
WHERE is_primary = TRUE AND is_active = TRUE;

CREATE TABLE IF NOT EXISTS expenses.business_partner_import_batches (
  import_batch_id BIGSERIAL PRIMARY KEY,
  partner_type TEXT NOT NULL
    CHECK (partner_type IN ('customer', 'vendor')),
  import_mode TEXT NOT NULL
    CHECK (import_mode IN ('validate', 'insert_only', 'upsert')),
  blank_mode TEXT NOT NULL
    CHECK (blank_mode IN ('preserve', 'clear')),
  file_name TEXT,
  total_count INTEGER NOT NULL DEFAULT 0,
  insert_count INTEGER NOT NULL DEFAULT 0,
  update_count INTEGER NOT NULL DEFAULT 0,
  unchanged_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  fatal_error TEXT,
  requested_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS expenses.business_partner_import_rows (
  import_row_id BIGSERIAL PRIMARY KEY,
  import_batch_id BIGINT NOT NULL
    REFERENCES expenses.business_partner_import_batches(import_batch_id)
    ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  matched_id BIGINT,
  program_code TEXT,
  display_name TEXT,
  is_valid BOOLEAN NOT NULL DEFAULT FALSE,
  error_code TEXT,
  error_message TEXT,
  source_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_business_partner_import_rows_batch
ON expenses.business_partner_import_rows(import_batch_id, row_number);

COMMIT;
