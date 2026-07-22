CREATE TABLE IF NOT EXISTS accounting.payment_document_contract_insurance_lease_item_lines (
    lease_item_line_id BIGSERIAL PRIMARY KEY,

    contract_insurance_lease_draft_id BIGINT NOT NULL
        REFERENCES accounting.payment_document_contract_insurance_lease_drafts(
            contract_insurance_lease_draft_id
        )
        ON DELETE CASCADE,

    lease_item_category_id BIGINT
        REFERENCES expenses.lease_item_categories(
            lease_item_category_id
        ),

    lease_item_category_code VARCHAR(100),
    lease_item_category_name TEXT NOT NULL DEFAULT '',

    item_name TEXT NOT NULL DEFAULT '',
    manufacturer_name TEXT,
    model_number TEXT,
    serial_number TEXT,

    quantity NUMERIC,
    unit_name TEXT,

    lease_start_date DATE,
    lease_end_date DATE,
    lease_period_months INTEGER,

    item_location TEXT,

    monthly_lease_amount NUMERIC,
    lease_total_amount NUMERIC,
    residual_value_amount NUMERIC,
    residual_value_guarantee_amount NUMERIC,

    ai_confidence NUMERIC,
    is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cil_lease_item_lines_quantity_check
        CHECK (quantity IS NULL OR quantity >= 0),

    CONSTRAINT cil_lease_item_lines_period_check
        CHECK (lease_period_months IS NULL OR lease_period_months >= 0)
);

CREATE INDEX IF NOT EXISTS
    idx_cil_lease_item_lines_draft_id
ON accounting.payment_document_contract_insurance_lease_item_lines(
    contract_insurance_lease_draft_id
);

CREATE INDEX IF NOT EXISTS
    idx_cil_lease_item_lines_category_id
ON accounting.payment_document_contract_insurance_lease_item_lines(
    lease_item_category_id
);