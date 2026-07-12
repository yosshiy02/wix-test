BEGIN;

COMMENT ON COLUMN sales.products.product_code IS
  '画面上の商品ID';

COMMENT ON COLUMN sales.products.product_name IS
  '商品名';

COMMENT ON COLUMN sales.products.standard_price IS
  '商品マスターでは使用しない。単価は得意先別単価で管理する';

COMMENT ON COLUMN sales.products.standard_cost IS
  '商品マスター画面では使用しない既存互換列';

COMMENT ON COLUMN sales.products.color_name IS
  '新商品マスターでは使用しない既存互換列。色はsales.colorsで管理する';

COMMENT ON COLUMN sales.products.size_name IS
  '新商品マスターでは使用しない既存互換列。サイズはsales.product_sizesで管理する';

ALTER TABLE sales.products
  ALTER COLUMN unit_name
  SET DEFAULT '足';

CREATE TABLE IF NOT EXISTS sales.colors (
  color_id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  color_code VARCHAR(20) NOT NULL,
  color_name VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sales_colors_company_code_unique
    UNIQUE (
      company_id,
      color_code
    )
);

COMMENT ON TABLE sales.colors IS
  '会社別の色マスター';

COMMENT ON COLUMN sales.colors.color_id IS
  'DB内部の色番号';

COMMENT ON COLUMN sales.colors.color_code IS
  '画面上の色ID。01、02、03等';

COMMENT ON COLUMN sales.colors.color_name IS
  '色名';

CREATE INDEX IF NOT EXISTS
  sales_colors_company_active_sort_idx
ON sales.colors (
  company_id,
  is_active,
  sort_order,
  color_code
);

CREATE TABLE IF NOT EXISTS sales.product_sizes (
  size_id BIGSERIAL PRIMARY KEY,
  size_code VARCHAR(30) NOT NULL,
  size_name VARCHAR(100) NOT NULL,
  size_category VARCHAR(30) NOT NULL DEFAULT 'OTHER',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sales_product_sizes_size_code_unique
    UNIQUE (size_code)
);

COMMENT ON TABLE sales.product_sizes IS
  '共通の商品サイズマスター。将来の追加を前提とする';

COMMENT ON COLUMN sales.product_sizes.size_id IS
  'DB内部のサイズ番号';

COMMENT ON COLUMN sales.product_sizes.size_code IS
  '登録及びプログラム用サイズコード';

COMMENT ON COLUMN sales.product_sizes.size_name IS
  '画面表示用サイズ名';

INSERT INTO sales.product_sizes (
  size_code,
  size_name,
  size_category,
  sort_order
)
VALUES
  ('21.5', '21.5cm', 'CM', 10),
  ('22.0', '22.0cm', 'CM', 20),
  ('22.5', '22.5cm', 'CM', 30),
  ('23.0', '23.0cm', 'CM', 40),
  ('23.5', '23.5cm', 'CM', 50),
  ('24.0', '24.0cm', 'CM', 60),
  ('24.5', '24.5cm', 'CM', 70),
  ('25.0', '25.0cm', 'CM', 80),
  ('S',    'S',      'ALPHA', 90),
  ('M',    'M',      'ALPHA', 100),
  ('L',    'L',      'ALPHA', 110),
  ('LL',   'LL',     'ALPHA', 120)
ON CONFLICT (size_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS sales.product_variants (
  variant_id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  color_id BIGINT NOT NULL,
  size_id BIGINT NOT NULL,
  variant_code VARCHAR(100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sales_product_variants_product_fk
    FOREIGN KEY (product_id)
    REFERENCES sales.products(product_id)
    ON DELETE CASCADE,

  CONSTRAINT sales_product_variants_color_fk
    FOREIGN KEY (color_id)
    REFERENCES sales.colors(color_id),

  CONSTRAINT sales_product_variants_size_fk
    FOREIGN KEY (size_id)
    REFERENCES sales.product_sizes(size_id)
);

COMMENT ON TABLE sales.product_variants IS
  '商品、色、サイズの組合せを管理する商品明細';

COMMENT ON COLUMN sales.product_variants.variant_id IS
  '商品明細のDB内部番号';

COMMENT ON COLUMN sales.product_variants.variant_code IS
  '将来の商品明細コード、JANコード等への拡張用';

CREATE UNIQUE INDEX IF NOT EXISTS
  sales_product_variants_company_product_color_size_unique
ON sales.product_variants (
  company_id,
  product_id,
  color_id,
  size_id
);

CREATE INDEX IF NOT EXISTS
  sales_product_variants_company_idx
ON sales.product_variants (
  company_id
);

CREATE INDEX IF NOT EXISTS
  sales_product_variants_product_idx
ON sales.product_variants (
  product_id
);

CREATE INDEX IF NOT EXISTS
  sales_product_variants_color_idx
ON sales.product_variants (
  color_id
);

CREATE INDEX IF NOT EXISTS
  sales_product_variants_size_idx
ON sales.product_variants (
  size_id
);

CREATE OR REPLACE FUNCTION
  sales.ensure_product_variant_company_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sales.products AS product
    WHERE product.product_id = NEW.product_id
      AND product.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION
      '商品と商品明細の会社IDが一致しません。product_id=%, company_id=%',
      NEW.product_id,
      NEW.company_id
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM sales.colors AS color
    WHERE color.color_id = NEW.color_id
      AND color.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION
      '色と商品明細の会社IDが一致しません。color_id=%, company_id=%',
      NEW.color_id,
      NEW.company_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS
  sales_product_variants_company_match_trigger
ON sales.product_variants;

CREATE TRIGGER
  sales_product_variants_company_match_trigger
BEFORE INSERT OR UPDATE OF
  company_id,
  product_id,
  color_id
ON sales.product_variants
FOR EACH ROW
EXECUTE FUNCTION
  sales.ensure_product_variant_company_match();

COMMIT;
