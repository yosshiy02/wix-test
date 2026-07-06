CREATE SCHEMA IF NOT EXISTS accounting;
CREATE SEQUENCE IF NOT EXISTS accounting.payable_no_seq;
CREATE TABLE IF NOT EXISTS accounting.payable_documents (
  payable_id BIGSERIAL PRIMARY KEY,
  payable_no TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL DEFAULT 'invoice',
  payable_kind TEXT NOT NULL DEFAULT 'unpaid',
  status TEXT NOT NULL DEFAULT 'draft',
  vendor_id BIGINT NULL,
  vendor_name TEXT NOT NULL DEFAULT '',
  invoice_number TEXT NOT NULL DEFAULT '',
  supplier_document_no TEXT NOT NULL DEFAULT '',
  document_date DATE NULL,
  posting_date DATE NULL,
  due_date DATE NULL,
  payment_plan_date DATE NULL,
  currency_code TEXT NOT NULL DEFAULT 'JPY',
  subtotal_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  withholding_tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  account_payable_title_id BIGINT NULL,
  payment_method_id BIGINT NULL,
  target_person_id BIGINT NULL,
  purpose_id BIGINT NULL,
  project_id BIGINT NULL,
  department_id BIGINT NULL,
  summary TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '',
  internal_note TEXT NOT NULL DEFAULT '',
  evidence_type TEXT NOT NULL DEFAULT '',
  evidence_file_name TEXT NOT NULL DEFAULT '',
  evidence_file_path TEXT NOT NULL DEFAULT '',
  source_memo TEXT NOT NULL DEFAULT '',
  journal_status TEXT NOT NULL DEFAULT 'not_created',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT payable_documents_status_chk
    CHECK (status IN ('draft','confirmed','partially_paid','paid','void')),
  CONSTRAINT payable_documents_document_type_chk
    CHECK (document_type IN ('invoice','statement','credit_note','other')),
  CONSTRAINT payable_documents_payable_kind_chk
    CHECK (payable_kind IN ('accounts_payable','unpaid','accrued_expense','card_payable','other')),
  CONSTRAINT payable_documents_amount_chk
    CHECK (
      subtotal_amount >= 0
      AND tax_amount >= 0
      AND withholding_tax_amount >= 0
      AND total_amount >= 0
      AND paid_amount >= 0
      AND balance_amount >= 0
    )
);
CREATE TABLE IF NOT EXISTS accounting.payable_lines (
  payable_line_id BIGSERIAL PRIMARY KEY,
  payable_id BIGINT NOT NULL REFERENCES accounting.payable_documents(payable_id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  account_title_id BIGINT NULL,
  tax_category_id BIGINT NULL,
  item_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_ex_tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_in_tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_person_id BIGINT NULL,
  purpose_id BIGINT NULL,
  project_id BIGINT NULL,
  department_id BIGINT NULL,
  memo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payable_lines_line_no_uk UNIQUE (payable_id, line_no),
  CONSTRAINT payable_lines_amount_chk
    CHECK (
      quantity >= 0
      AND unit_price >= 0
      AND amount_ex_tax >= 0
      AND tax_rate >= 0
      AND tax_amount >= 0
      AND amount_in_tax >= 0
    )
);
CREATE TABLE IF NOT EXISTS accounting.payable_payments (
  payable_payment_id BIGSERIAL PRIMARY KEY,
  payable_id BIGINT NOT NULL REFERENCES accounting.payable_documents(payable_id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  payment_method_id BIGINT NULL,
  payment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  bank_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  withholding_tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  memo TEXT NOT NULL DEFAULT '',
  journal_status TEXT NOT NULL DEFAULT 'not_created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payable_payments_amount_chk
    CHECK (
      payment_amount >= 0
      AND bank_fee_amount >= 0
      AND withholding_tax_amount >= 0
    )
);
CREATE TABLE IF NOT EXISTS accounting.payable_status_history (
  payable_status_history_id BIGSERIAL PRIMARY KEY,
  payable_id BIGINT NOT NULL REFERENCES accounting.payable_documents(payable_id) ON DELETE CASCADE,
  old_status TEXT NOT NULL DEFAULT '',
  new_status TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payable_documents_status_idx
  ON accounting.payable_documents(status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS payable_documents_due_date_idx
  ON accounting.payable_documents(due_date)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS payable_documents_vendor_name_idx
  ON accounting.payable_documents(vendor_name)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS payable_lines_payable_id_idx
  ON accounting.payable_lines(payable_id);
CREATE INDEX IF NOT EXISTS payable_payments_payable_id_idx
  ON accounting.payable_payments(payable_id);
CREATE OR REPLACE FUNCTION accounting.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_payable_documents_updated_at ON accounting.payable_documents;
CREATE TRIGGER trg_payable_documents_updated_at
BEFORE UPDATE ON accounting.payable_documents
FOR EACH ROW
EXECUTE FUNCTION accounting.set_updated_at();
DROP TRIGGER IF EXISTS trg_payable_lines_updated_at ON accounting.payable_lines;
CREATE TRIGGER trg_payable_lines_updated_at
BEFORE UPDATE ON accounting.payable_lines
FOR EACH ROW
EXECUTE FUNCTION accounting.set_updated_at();
DROP TRIGGER IF EXISTS trg_payable_payments_updated_at ON accounting.payable_payments;
CREATE TRIGGER trg_payable_payments_updated_at
BEFORE UPDATE ON accounting.payable_payments
FOR EACH ROW
EXECUTE FUNCTION accounting.set_updated_at();
CREATE OR REPLACE VIEW accounting.v_payable_documents AS
WITH line_totals AS (
  SELECT
    payable_id,
    COUNT(*) AS line_count,
    COALESCE(SUM(amount_ex_tax), 0)::NUMERIC(14,2) AS calculated_subtotal_amount,
    COALESCE(SUM(tax_amount), 0)::NUMERIC(14,2) AS calculated_tax_amount,
    COALESCE(SUM(amount_in_tax), 0)::NUMERIC(14,2) AS calculated_total_amount
  FROM accounting.payable_lines
  GROUP BY payable_id
),
payment_totals AS (
  SELECT
    payable_id,
    COUNT(*) AS payment_count,
    COALESCE(SUM(payment_amount), 0)::NUMERIC(14,2) AS calculated_paid_amount,
    COALESCE(SUM(bank_fee_amount), 0)::NUMERIC(14,2) AS calculated_bank_fee_amount,
    COALESCE(SUM(withholding_tax_amount), 0)::NUMERIC(14,2) AS calculated_payment_withholding_tax_amount
  FROM accounting.payable_payments
  GROUP BY payable_id
)
SELECT
  d.*,
  COALESCE(l.line_count, 0) AS line_count,
  COALESCE(p.payment_count, 0) AS payment_count,
  COALESCE(l.calculated_subtotal_amount, d.subtotal_amount, 0)::NUMERIC(14,2) AS calculated_subtotal_amount,
  COALESCE(l.calculated_tax_amount, d.tax_amount, 0)::NUMERIC(14,2) AS calculated_tax_amount,
  COALESCE(l.calculated_total_amount, d.total_amount, 0)::NUMERIC(14,2) AS calculated_total_amount,
  COALESCE(p.calculated_paid_amount, d.paid_amount, 0)::NUMERIC(14,2) AS calculated_paid_amount,
  GREATEST(
    COALESCE(l.calculated_total_amount, d.total_amount, 0) - COALESCE(p.calculated_paid_amount, d.paid_amount, 0),
    0
  )::NUMERIC(14,2) AS calculated_balance_amount,
  CASE
    WHEN d.deleted_at IS NOT NULL THEN 'deleted'
    WHEN d.status = 'void' THEN 'void'
    WHEN COALESCE(l.calculated_total_amount, d.total_amount, 0) > 0
      AND COALESCE(p.calculated_paid_amount, d.paid_amount, 0) >= COALESCE(l.calculated_total_amount, d.total_amount, 0)
      THEN 'paid'
    WHEN COALESCE(p.calculated_paid_amount, d.paid_amount, 0) > 0 THEN 'partially_paid'
    ELSE d.status
  END AS effective_status,
  (
    d.due_date IS NOT NULL
    AND d.due_date < CURRENT_DATE
    AND d.status NOT IN ('paid','void')
    AND GREATEST(
      COALESCE(l.calculated_total_amount, d.total_amount, 0) - COALESCE(p.calculated_paid_amount, d.paid_amount, 0),
      0
    ) > 0
  ) AS is_overdue
FROM accounting.payable_documents d
LEFT JOIN line_totals l ON l.payable_id = d.payable_id
LEFT JOIN payment_totals p ON p.payable_id = d.payable_id
WHERE d.deleted_at IS NULL;
