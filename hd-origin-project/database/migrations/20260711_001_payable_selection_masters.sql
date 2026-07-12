CREATE TABLE IF NOT EXISTS
  accounting.payable_selection_masters (
    payable_selection_master_id BIGSERIAL PRIMARY KEY,
    master_type VARCHAR(80) NOT NULL,
    option_code VARCHAR(120) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (master_type, option_code)
  );

CREATE INDEX IF NOT EXISTS
  idx_payable_selection_masters_type_active
ON accounting.payable_selection_masters (
  master_type,
  is_active,
  sort_order
);

INSERT INTO accounting.payable_selection_masters
  (master_type, option_code, display_name, sort_order)
VALUES
  ('payable_statuses','draft','下書き',10),
  ('payable_statuses','confirmed','未払確定',20),
  ('payable_statuses','partially_paid','一部支払',30),
  ('payable_statuses','paid','支払済み',40),
  ('payable_statuses','void','無効',50),

  ('payable_document_types','invoice','請求書',10),
  ('payable_document_types','delivery_note','納品書',20),
  ('payable_document_types','statement','明細書',30),
  ('payable_document_types','credit_note','値引・返品',40),
  ('payable_document_types','other','その他',50),

  ('payable_kinds','accounts_payable','買掛金',10),
  ('payable_kinds','unpaid','未払金',20),
  ('payable_kinds','accrued_expense','未払費用',30),
  ('payable_kinds','card_payable','カード未払',40),
  ('payable_kinds','other','その他',50),

  ('evidence_types','pdf','PDF',10),
  ('evidence_types','paper','紙',20),
  ('evidence_types','email','メール',30),
  ('evidence_types','image','画像',40),
  ('evidence_types','other','その他',50),

  ('evidence_statuses','not_required','不要',10),
  ('evidence_statuses','received','回収済み',20),
  ('evidence_statuses','missing','未回収',30),
  ('evidence_statuses','pending','後日回収',40),
  ('evidence_statuses','mismatch','内容不一致',50),

  ('review_statuses','unreviewed','未確認',10),
  ('review_statuses','needs_review','要確認',20),
  ('review_statuses','confirmed','確認済み',30),
  ('review_statuses','rejected','差戻し',40),

  ('warning_levels','none','なし',10),
  ('warning_levels','info','情報',20),
  ('warning_levels','warning','警告',30),
  ('warning_levels','critical','重大',40),

  ('professional_review_statuses','not_required','不要',10),
  ('professional_review_statuses','pending','確認待ち',20),
  ('professional_review_statuses','requested','確認依頼済み',30),
  ('professional_review_statuses','confirmed','確認済み',40),
  ('professional_review_statuses','recheck_required','再確認必要',50)
ON CONFLICT (master_type, option_code)
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = now();