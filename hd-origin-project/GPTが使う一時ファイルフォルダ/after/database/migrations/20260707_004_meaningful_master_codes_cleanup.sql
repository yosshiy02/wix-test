BEGIN;

CREATE SCHEMA IF NOT EXISTS expenses;

-- 001系になりやすい実体マスタの内部コード列は外す。
-- これらはIDと表示名で管理する。
ALTER TABLE expenses.account_titles DROP COLUMN IF EXISTS account_title_code;
ALTER TABLE expenses.vendors DROP COLUMN IF EXISTS vendor_code;
ALTER TABLE expenses.target_people DROP COLUMN IF EXISTS target_person_code;
ALTER TABLE expenses.purposes DROP COLUMN IF EXISTS purpose_code;
ALTER TABLE expenses.projects DROP COLUMN IF EXISTS project_code;
ALTER TABLE expenses.departments DROP COLUMN IF EXISTS department_code;

-- プログラム判定に意味があるマスタだけ内部コードを持たせる。
ALTER TABLE expenses.payment_methods ADD COLUMN IF NOT EXISTS payment_method_code VARCHAR(50);
ALTER TABLE expenses.tax_categories ADD COLUMN IF NOT EXISTS tax_category_code VARCHAR(50);
ALTER TABLE expenses.invoice_types ADD COLUMN IF NOT EXISTS invoice_type_code VARCHAR(50);
ALTER TABLE expenses.evidence_types ADD COLUMN IF NOT EXISTS evidence_type_code VARCHAR(50);

-- もし過去に001系の仮コードを入れていた場合は消す。
-- 意味のあるコードは、マスタ管理画面から人間が決める。
UPDATE expenses.payment_methods
SET payment_method_code = NULL
WHERE payment_method_code ~ '^method_[0-9]{3}$';

UPDATE expenses.tax_categories
SET tax_category_code = NULL
WHERE tax_category_code ~ '^taxcat_[0-9]{3}$';

UPDATE expenses.invoice_types
SET invoice_type_code = NULL
WHERE invoice_type_code ~ '^invoice_type_[0-9]{3}$';

UPDATE expenses.evidence_types
SET evidence_type_code = NULL
WHERE evidence_type_code ~ '^evidence_[0-9]{3}$';

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_methods_payment_method_code
  ON expenses.payment_methods (payment_method_code)
  WHERE payment_method_code IS NOT NULL AND btrim(payment_method_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_tax_categories_tax_category_code
  ON expenses.tax_categories (tax_category_code)
  WHERE tax_category_code IS NOT NULL AND btrim(tax_category_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_types_invoice_type_code
  ON expenses.invoice_types (invoice_type_code)
  WHERE invoice_type_code IS NOT NULL AND btrim(invoice_type_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_evidence_types_evidence_type_code
  ON expenses.evidence_types (evidence_type_code)
  WHERE evidence_type_code IS NOT NULL AND btrim(evidence_type_code) <> '';

COMMIT;