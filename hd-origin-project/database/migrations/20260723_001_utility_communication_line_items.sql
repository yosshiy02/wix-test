CREATE TABLE IF NOT EXISTS accounting.payment_document_utility_communication_line_items (
  utility_communication_line_item_id BIGSERIAL PRIMARY KEY,
  utility_communication_draft_id BIGINT NOT NULL
    REFERENCES accounting.payment_document_utility_communication_drafts(utility_communication_draft_id)
    ON DELETE CASCADE,

  line_no INTEGER NOT NULL,
  item_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  usage_quantity NUMERIC(18,6),
  usage_unit TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC(18,4),
  subtotal_amount NUMERIC(18,2),

  tax_category_id BIGINT
    REFERENCES expenses.tax_categories(tax_category_id),
  tax_rate NUMERIC(8,4),
  tax_amount NUMERIC(18,2),
  total_amount NUMERIC(18,2),

  source_text TEXT NOT NULL DEFAULT '',
  raw_item_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (utility_communication_draft_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_utility_communication_line_items_draft
  ON accounting.payment_document_utility_communication_line_items
  (utility_communication_draft_id);