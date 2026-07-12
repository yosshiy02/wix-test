BEGIN;

CREATE SCHEMA IF NOT EXISTS expenses;

CREATE TABLE IF NOT EXISTS expenses.company_transaction_rules (
  company_transaction_rule_id BIGSERIAL PRIMARY KEY,

  company_id BIGINT NOT NULL
    REFERENCES expenses.companies(company_id)
    ON DELETE CASCADE,

  transaction_direction TEXT NOT NULL
    CHECK (
      transaction_direction IN (
        'sales',
        'purchase',
        'manufacturing_outsource',
        'manufacturing_consign'
      )
    ),

  rule_name TEXT NOT NULL DEFAULT '通常条件',

  deduction_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  deduction_rate NUMERIC(9,4),
  deduction_fixed_amount NUMERIC(14,2),

  calculation_base TEXT NOT NULL DEFAULT 'subtotal'
    CHECK (
      calculation_base IN (
        'line_amount',
        'subtotal',
        'invoice_total',
        'processing_fee',
        'custom'
      )
    ),

  tax_base TEXT NOT NULL DEFAULT 'before_tax'
    CHECK (
      tax_base IN (
        'before_tax',
        'after_tax',
        'not_applicable'
      )
    ),

  freight_treatment TEXT NOT NULL DEFAULT 'exclude'
    CHECK (
      freight_treatment IN (
        'include',
        'exclude',
        'separate',
        'not_applicable'
      )
    ),

  rounding_method TEXT NOT NULL DEFAULT 'round_down'
    CHECK (
      rounding_method IN (
        'round_down',
        'round',
        'round_up',
        'none'
      )
    ),

  rounding_unit INTEGER NOT NULL DEFAULT 1
    CHECK (rounding_unit IN (1, 10, 100, 1000)),

  target_brand TEXT,
  target_item_group TEXT,
  minimum_quantity NUMERIC(14,4),
  minimum_amount NUMERIC(14,2),

  effective_from DATE,
  effective_to DATE,

  structured_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  human_note TEXT,

  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (
    effective_to IS NULL
    OR effective_from IS NULL
    OR effective_to >= effective_from
  ),

  CHECK (
    deduction_rate IS NULL
    OR deduction_rate >= 0
  ),

  CHECK (
    deduction_fixed_amount IS NULL
    OR deduction_fixed_amount >= 0
  )
);

CREATE INDEX IF NOT EXISTS ix_company_transaction_rules_company
ON expenses.company_transaction_rules (
  company_id,
  transaction_direction,
  is_active
);

CREATE INDEX IF NOT EXISTS ix_company_transaction_rules_effective
ON expenses.company_transaction_rules (
  effective_from,
  effective_to
);

CREATE INDEX IF NOT EXISTS ix_company_transaction_rules_json
ON expenses.company_transaction_rules
USING GIN (structured_rule);

CREATE UNIQUE INDEX IF NOT EXISTS ux_company_transaction_rules_identity
ON expenses.company_transaction_rules (
  company_id,
  transaction_direction,
  rule_name,
  COALESCE(effective_from, DATE '1900-01-01')
);

COMMIT;
