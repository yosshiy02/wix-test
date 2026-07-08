BEGIN;

CREATE TABLE IF NOT EXISTS accounting.payment_document_contract_insurance_lease_drafts (
  contract_insurance_lease_draft_id BIGSERIAL PRIMARY KEY,

  payment_document_ocr_import_id BIGINT NOT NULL REFERENCES accounting.payment_document_ocr_imports(payment_document_ocr_import_id),
  payment_document_sorting_draft_id BIGINT REFERENCES accounting.payment_document_sorting_drafts(payment_document_sorting_draft_id),

  draft_no TEXT NOT NULL DEFAULT '',
  draft_version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  draft_status TEXT NOT NULL DEFAULT 'draft',
  human_check_status TEXT NOT NULL DEFAULT 'unchecked',

  original_file_name TEXT NOT NULL DEFAULT '',
  saved_file_name TEXT NOT NULL DEFAULT '',
  saved_relative_path TEXT NOT NULL DEFAULT '',
  sha256 TEXT NOT NULL DEFAULT '',
  ocr_text_length INTEGER NOT NULL DEFAULT 0,

  -- 基本分類：マスタから選ぶものは id/code/label を持つ
  document_type_id BIGINT,
  document_type_code TEXT NOT NULL DEFAULT '',
  document_type_label TEXT NOT NULL DEFAULT '',

  evidence_type_id BIGINT,
  evidence_type_code TEXT NOT NULL DEFAULT '',
  evidence_type_label TEXT NOT NULL DEFAULT '',

  payment_destination_id BIGINT,
  payment_destination_code TEXT NOT NULL DEFAULT '',
  payment_destination_label TEXT NOT NULL DEFAULT '',

  contract_insurance_lease_kind_id BIGINT,
  contract_insurance_lease_kind_code TEXT NOT NULL DEFAULT '',
  contract_insurance_lease_kind_label TEXT NOT NULL DEFAULT '',

  analysis_system_code TEXT NOT NULL DEFAULT 'contract_insurance_lease_analysis',
  analysis_system_label TEXT NOT NULL DEFAULT '契約・保険・リース解析システム',
  analysis_system_reason TEXT NOT NULL DEFAULT '',
  analysis_system_confidence TEXT NOT NULL DEFAULT '',

  ai_confidence TEXT NOT NULL DEFAULT '',
  ai_confidence_label TEXT NOT NULL DEFAULT '',
  ai_reason TEXT NOT NULL DEFAULT '',
  review_reason TEXT NOT NULL DEFAULT '',
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,

  -- 相手先・宛名
  issuer_name TEXT NOT NULL DEFAULT '',

  vendor_id BIGINT,
  vendor_code TEXT NOT NULL DEFAULT '',
  vendor_name TEXT NOT NULL DEFAULT '',

  insurance_company_id BIGINT,
  insurance_company_code TEXT NOT NULL DEFAULT '',
  insurance_company_name TEXT NOT NULL DEFAULT '',

  lease_company_id BIGINT,
  lease_company_code TEXT NOT NULL DEFAULT '',
  lease_company_name TEXT NOT NULL DEFAULT '',

  contract_partner_id BIGINT,
  contract_partner_code TEXT NOT NULL DEFAULT '',
  contract_partner_name TEXT NOT NULL DEFAULT '',

  recipient_name TEXT NOT NULL DEFAULT '',
  contractor_name TEXT NOT NULL DEFAULT '',
  insured_name TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  person_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',

  -- 番号・識別
  contract_no TEXT NOT NULL DEFAULT '',
  insurance_policy_no TEXT NOT NULL DEFAULT '',
  notice_no TEXT NOT NULL DEFAULT '',
  management_no TEXT NOT NULL DEFAULT '',
  customer_no TEXT NOT NULL DEFAULT '',
  member_no TEXT NOT NULL DEFAULT '',
  registration_no TEXT NOT NULL DEFAULT '',
  corporate_no TEXT NOT NULL DEFAULT '',

  -- 日付・期間
  document_date DATE,
  issue_date DATE,
  due_date DATE,
  payment_plan_date DATE,
  withdrawal_date DATE,

  contract_start_date DATE,
  contract_end_date DATE,
  service_period_start DATE,
  service_period_end DATE,
  renewal_date DATE,
  cancellation_notice_date DATE,
  cancellation_date DATE,

  -- 金額・税
  payment_amount NUMERIC(14,2),
  monthly_amount NUMERIC(14,2),
  annual_amount NUMERIC(14,2),
  total_amount NUMERIC(14,2),
  amount_ex_tax NUMERIC(14,2),
  tax_amount NUMERIC(14,2),
  amount_in_tax NUMERIC(14,2),
  non_tax_amount NUMERIC(14,2),
  fee_amount NUMERIC(14,2),
  late_fee_amount NUMERIC(14,2),
  discount_amount NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'JPY',

  -- 支払情報：マスタから選ぶものは id/code/label を持つ
  payment_method_id BIGINT,
  payment_method_code TEXT NOT NULL DEFAULT '',
  payment_method_label TEXT NOT NULL DEFAULT '',

  payment_status_id BIGINT,
  payment_status_code TEXT NOT NULL DEFAULT '',
  payment_status_label TEXT NOT NULL DEFAULT '',

  payment_cycle_id BIGINT,
  payment_cycle_code TEXT NOT NULL DEFAULT '',
  payment_cycle_label TEXT NOT NULL DEFAULT '',

  payment_count INTEGER,

  transfer_bank_name TEXT NOT NULL DEFAULT '',
  debit_bank_name TEXT NOT NULL DEFAULT '',
  bank_account_type_id BIGINT,
  bank_account_type_code TEXT NOT NULL DEFAULT '',
  bank_account_type_label TEXT NOT NULL DEFAULT '',
  bank_account_no TEXT NOT NULL DEFAULT '',
  bank_account_name TEXT NOT NULL DEFAULT '',

  -- 会計・未払管理：マスタから選ぶ
  accounting_category_id BIGINT,
  accounting_category_code TEXT NOT NULL DEFAULT '',
  accounting_category_label TEXT NOT NULL DEFAULT '',

  payable_kind_id BIGINT,
  payable_kind_code TEXT NOT NULL DEFAULT '',
  payable_kind_label TEXT NOT NULL DEFAULT '',

  account_title_id BIGINT,
  account_title_code TEXT NOT NULL DEFAULT '',
  account_title_label TEXT NOT NULL DEFAULT '',

  tax_category_id BIGINT,
  tax_category_code TEXT NOT NULL DEFAULT '',
  tax_category_label TEXT NOT NULL DEFAULT '',

  invoice_type_id BIGINT,
  invoice_type_code TEXT NOT NULL DEFAULT '',
  invoice_type_label TEXT NOT NULL DEFAULT '',

  target_person_id BIGINT,
  target_person_code TEXT NOT NULL DEFAULT '',
  target_person_label TEXT NOT NULL DEFAULT '',

  purpose_id BIGINT,
  purpose_code TEXT NOT NULL DEFAULT '',
  purpose_label TEXT NOT NULL DEFAULT '',

  project_id BIGINT,
  project_code TEXT NOT NULL DEFAULT '',
  project_label TEXT NOT NULL DEFAULT '',

  department_id BIGINT,
  department_code TEXT NOT NULL DEFAULT '',
  department_label TEXT NOT NULL DEFAULT '',

  payable_registration_id BIGINT,
  payable_registration_code TEXT NOT NULL DEFAULT '',
  payable_registration_label TEXT NOT NULL DEFAULT '',

  accounts_payable_registration_id BIGINT,
  accounts_payable_registration_code TEXT NOT NULL DEFAULT '',
  accounts_payable_registration_label TEXT NOT NULL DEFAULT '',

  company_burden_id BIGINT,
  company_burden_code TEXT NOT NULL DEFAULT '',
  company_burden_label TEXT NOT NULL DEFAULT '',

  mixed_personal_flag_id BIGINT,
  mixed_personal_flag_code TEXT NOT NULL DEFAULT '',
  mixed_personal_flag_label TEXT NOT NULL DEFAULT '',

  summary TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '',
  internal_memo TEXT NOT NULL DEFAULT '',
  review_memo TEXT NOT NULL DEFAULT '',

  -- 保険専用
  insurance_type_id BIGINT,
  insurance_type_code TEXT NOT NULL DEFAULT '',
  insurance_type_label TEXT NOT NULL DEFAULT '',
  insurance_target TEXT NOT NULL DEFAULT '',
  insurance_period_start DATE,
  insurance_period_end DATE,
  insurance_amount NUMERIC(14,2),

  -- リース専用
  lease_item_name TEXT NOT NULL DEFAULT '',
  lease_item_category_id BIGINT,
  lease_item_category_code TEXT NOT NULL DEFAULT '',
  lease_item_category_label TEXT NOT NULL DEFAULT '',
  monthly_lease_amount NUMERIC(14,2),
  lease_total_amount NUMERIC(14,2),
  ownership_transfer_id BIGINT,
  ownership_transfer_code TEXT NOT NULL DEFAULT '',
  ownership_transfer_label TEXT NOT NULL DEFAULT '',
  early_cancellation_id BIGINT,
  early_cancellation_code TEXT NOT NULL DEFAULT '',
  early_cancellation_label TEXT NOT NULL DEFAULT '',
  residual_value_amount NUMERIC(14,2),

  -- 契約専用
  contract_type_id BIGINT,
  contract_type_code TEXT NOT NULL DEFAULT '',
  contract_type_label TEXT NOT NULL DEFAULT '',
  contract_name TEXT NOT NULL DEFAULT '',
  auto_renewal_id BIGINT,
  auto_renewal_code TEXT NOT NULL DEFAULT '',
  auto_renewal_label TEXT NOT NULL DEFAULT '',
  contract_status_id BIGINT,
  contract_status_code TEXT NOT NULL DEFAULT '',
  contract_status_label TEXT NOT NULL DEFAULT '',
  monthly_contract_amount NUMERIC(14,2),
  annual_contract_amount NUMERIC(14,2),

  -- JSON保持：AI生データ・補助・表示・修正履歴
  specialist_fields_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  visible_fields_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  human_corrections_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_by_page TEXT NOT NULL DEFAULT 'payment-document-specialist-contract-insurance-lease',
  created_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cil_drafts_ocr_import_id
  ON accounting.payment_document_contract_insurance_lease_drafts(payment_document_ocr_import_id);

CREATE INDEX IF NOT EXISTS idx_cil_drafts_sorting_draft_id
  ON accounting.payment_document_contract_insurance_lease_drafts(payment_document_sorting_draft_id);

CREATE INDEX IF NOT EXISTS idx_cil_drafts_current
  ON accounting.payment_document_contract_insurance_lease_drafts(is_current, deleted_at);

CREATE INDEX IF NOT EXISTS idx_cil_drafts_kind
  ON accounting.payment_document_contract_insurance_lease_drafts(contract_insurance_lease_kind_code);

CREATE INDEX IF NOT EXISTS idx_cil_drafts_vendor
  ON accounting.payment_document_contract_insurance_lease_drafts(vendor_id, vendor_name);

CREATE INDEX IF NOT EXISTS idx_cil_drafts_due_date
  ON accounting.payment_document_contract_insurance_lease_drafts(due_date);

CREATE INDEX IF NOT EXISTS idx_cil_drafts_contract_period
  ON accounting.payment_document_contract_insurance_lease_drafts(contract_start_date, contract_end_date);

COMMENT ON TABLE accounting.payment_document_contract_insurance_lease_drafts
  IS '契約・保険・リース専門解析の下書き。共通仕分け後、未払管理・会計連携前に重要項目を整理する。';

COMMIT;
