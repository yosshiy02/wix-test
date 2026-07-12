BEGIN;

UPDATE sales.customer_prices
SET company_id = p.company_id
FROM sales.products AS p
WHERE sales.customer_prices.company_id IS NULL
  AND p.product_id = sales.customer_prices.product_id;

UPDATE sales.customer_prices
SET effective_from = CURRENT_DATE
WHERE effective_from IS NULL;

ALTER TABLE sales.customer_prices
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE sales.customer_prices
  ALTER COLUMN effective_from SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_prices_customer_id_fkey'
      AND conrelid = 'sales.customer_prices'::regclass
  ) THEN
    ALTER TABLE sales.customer_prices
      ADD CONSTRAINT customer_prices_customer_id_fkey
      FOREIGN KEY (customer_id)
      REFERENCES expenses.customers(customer_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_prices_unit_price_check'
      AND conrelid = 'sales.customer_prices'::regclass
  ) THEN
    ALTER TABLE sales.customer_prices
      ADD CONSTRAINT customer_prices_unit_price_check
      CHECK (unit_price >= 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_prices_effective_period_check'
      AND conrelid = 'sales.customer_prices'::regclass
  ) THEN
    ALTER TABLE sales.customer_prices
      ADD CONSTRAINT customer_prices_effective_period_check
      CHECK (
        effective_to IS NULL
        OR effective_to >= effective_from
      );
  END IF;
END
$$;

DROP INDEX IF EXISTS sales.ux_sales_customer_prices_company;

CREATE UNIQUE INDEX IF NOT EXISTS
  ux_sales_customer_prices_company_customer_product_date
ON sales.customer_prices (
  company_id,
  customer_id,
  product_id,
  effective_from
);

CREATE INDEX IF NOT EXISTS
  ix_sales_customer_prices_resolve
ON sales.customer_prices (
  company_id,
  customer_id,
  product_id,
  is_active,
  effective_from DESC,
  effective_to
);

COMMIT;