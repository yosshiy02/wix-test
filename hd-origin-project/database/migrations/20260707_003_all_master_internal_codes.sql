BEGIN;

CREATE SCHEMA IF NOT EXISTS expenses;

ALTER TABLE expenses.account_titles ADD COLUMN IF NOT EXISTS account_title_code VARCHAR(50);
ALTER TABLE expenses.payment_methods ADD COLUMN IF NOT EXISTS payment_method_code VARCHAR(50);
ALTER TABLE expenses.tax_categories ADD COLUMN IF NOT EXISTS tax_category_code VARCHAR(50);
ALTER TABLE expenses.vendors ADD COLUMN IF NOT EXISTS vendor_code VARCHAR(50);
ALTER TABLE expenses.target_people ADD COLUMN IF NOT EXISTS target_person_code VARCHAR(50);
ALTER TABLE expenses.purposes ADD COLUMN IF NOT EXISTS purpose_code VARCHAR(50);
ALTER TABLE expenses.projects ADD COLUMN IF NOT EXISTS project_code VARCHAR(50);
ALTER TABLE expenses.departments ADD COLUMN IF NOT EXISTS department_code VARCHAR(50);
ALTER TABLE expenses.invoice_types ADD COLUMN IF NOT EXISTS invoice_type_code VARCHAR(50);
ALTER TABLE expenses.evidence_types ADD COLUMN IF NOT EXISTS evidence_type_code VARCHAR(50);

WITH numbered AS (
  SELECT account_title_id, row_number() OVER (ORDER BY account_title_id) AS rn
  FROM expenses.account_titles
  WHERE account_title_code IS NULL OR btrim(account_title_code) = ''
)
UPDATE expenses.account_titles t
SET account_title_code = 'acct_' || lpad(numbered.rn::text, 3, '0')
FROM numbered
WHERE t.account_title_id = numbered.account_title_id;

WITH numbered AS (
  SELECT payment_method_id, row_number() OVER (ORDER BY payment_method_id) AS rn
  FROM expenses.payment_methods
  WHERE payment_method_code IS NULL OR btrim(payment_method_code) = ''
)
UPDATE expenses.payment_methods t
SET payment_method_code = 'method_' || lpad(numbered.rn::text, 3, '0')
FROM numbered
WHERE t.payment_method_id = numbered.payment_method_id;

WITH numbered AS (
  SELECT tax_category_id, row_number() OVER (ORDER BY tax_category_id) AS rn
  FROM expenses.tax_categories
  WHERE tax_category_code IS NULL OR btrim(tax_category_code) = ''
)
UPDATE expenses.tax_categories t
SET tax_category_code = 'taxcat_' || lpad(numbered.rn::text, 3, '0')
FROM numbered
WHERE t.tax_category_id = numbered.tax_category_id;

WITH numbered AS (
  SELECT vendor_id, row_number() OVER (ORDER BY vendor_id) AS rn
  FROM expenses.vendors
  WHERE vendor_code IS NULL OR btrim(vendor_code) = ''
)
UPDATE expenses.vendors t
SET vendor_code = 'vendor_' || lpad(numbered.rn::text, 3, '0')
FROM numbered
WHERE t.vendor_id = numbered.vendor_id;

WITH numbered AS (
  SELECT target_person_id, row_number() OVER (ORDER BY target_person_id) AS rn
  FROM expenses.target_people
  WHERE target_person_code IS NULL OR btrim(target_person_code) = ''
)
UPDATE expenses.target_people t
SET target_person_code = 'person_' || lpad(numbered.rn::text, 3, '0')
FROM numbered
WHERE t.target_person_id = numbered.target_person_id;

WITH numbered AS (
  SELECT purpose_id, row_number() OVER (ORDER BY purpose_id) AS rn
  FROM expenses.purposes
  WHERE purpose_code IS NULL OR btrim(purpose_code) = ''
)
UPDATE expenses.purposes t
SET purpose_code = 'purpose_' || lpad(numbered.rn::text, 3, '0')
FROM numbered
WHERE t.purpose_id = numbered.purpose_id;

WITH numbered AS (
  SELECT project_id, row_number() OVER (ORDER BY project_id) AS rn
  FROM expenses.projects
  WHERE project_code IS NULL OR btrim(project_code) = ''
)
UPDATE expenses.projects t
SET project_code = 'project_' || lpad(numbered.rn::text, 3, '0')
FROM numbered
WHERE t.project_id = numbered.project_id;

WITH numbered AS (
  SELECT department_id, row_number() OVER (ORDER BY department_id) AS rn
  FROM expenses.departments
  WHERE department_code IS NULL OR btrim(department_code) = ''
)
UPDATE expenses.departments t
SET department_code = 'dept_' || lpad(numbered.rn::text, 3, '0')
FROM numbered
WHERE t.department_id = numbered.department_id;

WITH numbered AS (
  SELECT invoice_type_id, row_number() OVER (ORDER BY invoice_type_id) AS rn
  FROM expenses.invoice_types
  WHERE invoice_type_code IS NULL OR btrim(invoice_type_code) = ''
)
UPDATE expenses.invoice_types t
SET invoice_type_code = 'invoice_type_' || lpad(numbered.rn::text, 3, '0')
FROM numbered
WHERE t.invoice_type_id = numbered.invoice_type_id;

WITH numbered AS (
  SELECT evidence_type_id, row_number() OVER (ORDER BY evidence_type_id) AS rn
  FROM expenses.evidence_types
  WHERE evidence_type_code IS NULL OR btrim(evidence_type_code) = ''
)
UPDATE expenses.evidence_types t
SET evidence_type_code = 'evidence_' || lpad(numbered.rn::text, 3, '0')
FROM numbered
WHERE t.evidence_type_id = numbered.evidence_type_id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_account_titles_account_title_code
  ON expenses.account_titles (account_title_code)
  WHERE account_title_code IS NOT NULL AND btrim(account_title_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_methods_payment_method_code
  ON expenses.payment_methods (payment_method_code)
  WHERE payment_method_code IS NOT NULL AND btrim(payment_method_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_tax_categories_tax_category_code
  ON expenses.tax_categories (tax_category_code)
  WHERE tax_category_code IS NOT NULL AND btrim(tax_category_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_vendors_vendor_code
  ON expenses.vendors (vendor_code)
  WHERE vendor_code IS NOT NULL AND btrim(vendor_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_target_people_target_person_code
  ON expenses.target_people (target_person_code)
  WHERE target_person_code IS NOT NULL AND btrim(target_person_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_purposes_purpose_code
  ON expenses.purposes (purpose_code)
  WHERE purpose_code IS NOT NULL AND btrim(purpose_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_project_code
  ON expenses.projects (project_code)
  WHERE project_code IS NOT NULL AND btrim(project_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_departments_department_code
  ON expenses.departments (department_code)
  WHERE department_code IS NOT NULL AND btrim(department_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_types_invoice_type_code
  ON expenses.invoice_types (invoice_type_code)
  WHERE invoice_type_code IS NOT NULL AND btrim(invoice_type_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_evidence_types_evidence_type_code
  ON expenses.evidence_types (evidence_type_code)
  WHERE evidence_type_code IS NOT NULL AND btrim(evidence_type_code) <> '';

COMMIT;