BEGIN;

CREATE SCHEMA IF NOT EXISTS expenses;

CREATE TABLE IF NOT EXISTS expenses.payable_statuses (
  payable_status_id BIGSERIAL PRIMARY KEY,
  payable_status_code TEXT NOT NULL,
  payable_status_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payable_statuses_code_uidx
ON expenses.payable_statuses (payable_status_code);

CREATE TABLE IF NOT EXISTS expenses.evidence_statuses (
  evidence_status_id BIGSERIAL PRIMARY KEY,
  evidence_status_code TEXT NOT NULL,
  evidence_status_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS evidence_statuses_code_uidx
ON expenses.evidence_statuses (evidence_status_code);

CREATE TABLE IF NOT EXISTS expenses.review_statuses (
  review_status_id BIGSERIAL PRIMARY KEY,
  review_status_code TEXT NOT NULL,
  review_status_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS review_statuses_code_uidx
ON expenses.review_statuses (review_status_code);

CREATE TABLE IF NOT EXISTS expenses.warning_levels (
  warning_level_id BIGSERIAL PRIMARY KEY,
  warning_level_code TEXT NOT NULL,
  warning_level_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS warning_levels_code_uidx
ON expenses.warning_levels (warning_level_code);

CREATE TABLE IF NOT EXISTS expenses.professional_review_statuses (
  professional_review_status_id BIGSERIAL PRIMARY KEY,
  professional_review_status_code TEXT NOT NULL,
  professional_review_status_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS professional_review_statuses_code_uidx
ON expenses.professional_review_statuses (
  professional_review_status_code
);

ALTER TABLE expenses.document_types
ADD COLUMN IF NOT EXISTS document_type_code TEXT;

ALTER TABLE expenses.payable_kinds
ADD COLUMN IF NOT EXISTS payable_kind_code TEXT;

ALTER TABLE expenses.evidence_types
ADD COLUMN IF NOT EXISTS evidence_type_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS document_types_code_uidx
ON expenses.document_types (document_type_code)
WHERE document_type_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payable_kinds_code_uidx
ON expenses.payable_kinds (payable_kind_code)
WHERE payable_kind_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS evidence_types_code_uidx
ON expenses.evidence_types (evidence_type_code)
WHERE evidence_type_code IS NOT NULL;

INSERT INTO expenses.payable_statuses (
  payable_status_code,
  payable_status_name,
  sort_order
)
VALUES
  ('draft', '下書き', 10),
  ('confirmed', '未払確定', 20),
  ('partially_paid', '一部支払', 30),
  ('paid', '支払済み', 40),
  ('void', '無効', 50)
ON CONFLICT (payable_status_code)
DO UPDATE SET
  payable_status_name = EXCLUDED.payable_status_name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO expenses.evidence_statuses (
  evidence_status_code,
  evidence_status_name,
  sort_order
)
VALUES
  ('not_required', '不要', 10),
  ('received', '回収済み', 20),
  ('missing', '未回収', 30),
  ('pending', '後日回収', 40),
  ('mismatch', '内容不一致', 50)
ON CONFLICT (evidence_status_code)
DO UPDATE SET
  evidence_status_name = EXCLUDED.evidence_status_name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO expenses.review_statuses (
  review_status_code,
  review_status_name,
  sort_order
)
VALUES
  ('unreviewed', '未確認', 10),
  ('needs_review', '要確認', 20),
  ('confirmed', '確認済み', 30),
  ('rejected', '差戻し', 40)
ON CONFLICT (review_status_code)
DO UPDATE SET
  review_status_name = EXCLUDED.review_status_name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO expenses.warning_levels (
  warning_level_code,
  warning_level_name,
  sort_order
)
VALUES
  ('none', 'なし', 10),
  ('info', '情報', 20),
  ('warning', '警告', 30),
  ('critical', '重大', 40)
ON CONFLICT (warning_level_code)
DO UPDATE SET
  warning_level_name = EXCLUDED.warning_level_name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO expenses.professional_review_statuses (
  professional_review_status_code,
  professional_review_status_name,
  sort_order
)
VALUES
  ('not_required', '不要', 10),
  ('pending', '確認待ち', 20),
  ('requested', '確認依頼済み', 30),
  ('confirmed', '確認済み', 40),
  ('recheck_required', '再確認必要', 50)
ON CONFLICT (professional_review_status_code)
DO UPDATE SET
  professional_review_status_name =
    EXCLUDED.professional_review_status_name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

UPDATE expenses.document_types
SET document_type_code =
  CASE document_type_name
    WHEN '請求書' THEN 'invoice'
    WHEN '納品書' THEN 'delivery_note'
    WHEN '明細書' THEN 'statement'
    WHEN '値引・返品' THEN 'credit_note'
    WHEN 'その他' THEN 'other'
    ELSE document_type_code
  END
WHERE document_type_name IN (
  '請求書',
  '納品書',
  '明細書',
  '値引・返品',
  'その他'
)
AND (
  document_type_code IS NULL OR
  document_type_code = ''
);

INSERT INTO expenses.document_types (
  document_type_code,
  document_type_name,
  sort_order,
  is_active
)
SELECT
  source.document_type_code,
  source.document_type_name,
  source.sort_order,
  TRUE
FROM (
  VALUES
    ('invoice', '請求書', 10),
    ('delivery_note', '納品書', 20),
    ('statement', '明細書', 30),
    ('credit_note', '値引・返品', 40),
    ('other', 'その他', 50)
) AS source (
  document_type_code,
  document_type_name,
  sort_order
)
WHERE NOT EXISTS (
  SELECT 1
  FROM expenses.document_types target
  WHERE target.document_type_code =
        source.document_type_code
);

UPDATE expenses.payable_kinds
SET payable_kind_code =
  CASE payable_kind_name
    WHEN '買掛金' THEN 'accounts_payable'
    WHEN '未払金' THEN 'unpaid'
    WHEN '未払費用' THEN 'accrued_expense'
    WHEN 'カード未払' THEN 'card_payable'
    WHEN 'その他' THEN 'other'
    ELSE payable_kind_code
  END
WHERE payable_kind_name IN (
  '買掛金',
  '未払金',
  '未払費用',
  'カード未払',
  'その他'
)
AND (
  payable_kind_code IS NULL OR
  payable_kind_code = ''
);

INSERT INTO expenses.payable_kinds (
  payable_kind_code,
  payable_kind_name,
  sort_order,
  is_active
)
SELECT
  source.payable_kind_code,
  source.payable_kind_name,
  source.sort_order,
  TRUE
FROM (
  VALUES
    ('accounts_payable', '買掛金', 10),
    ('unpaid', '未払金', 20),
    ('accrued_expense', '未払費用', 30),
    ('card_payable', 'カード未払', 40),
    ('other', 'その他', 50)
) AS source (
  payable_kind_code,
  payable_kind_name,
  sort_order
)
WHERE NOT EXISTS (
  SELECT 1
  FROM expenses.payable_kinds target
  WHERE target.payable_kind_code =
        source.payable_kind_code
);

UPDATE expenses.evidence_types
SET evidence_type_code =
  CASE evidence_type_name
    WHEN 'PDF' THEN 'pdf'
    WHEN '紙' THEN 'paper'
    WHEN 'メール' THEN 'email'
    WHEN '画像' THEN 'image'
    WHEN 'その他' THEN 'other'
    ELSE evidence_type_code
  END
WHERE evidence_type_name IN (
  'PDF',
  '紙',
  'メール',
  '画像',
  'その他'
)
AND (
  evidence_type_code IS NULL OR
  evidence_type_code = ''
);

INSERT INTO expenses.evidence_types (
  evidence_type_code,
  evidence_type_name,
  sort_order,
  is_active
)
SELECT
  source.evidence_type_code,
  source.evidence_type_name,
  source.sort_order,
  TRUE
FROM (
  VALUES
    ('pdf', 'PDF', 110),
    ('paper', '紙', 120),
    ('email', 'メール', 130),
    ('image', '画像', 140),
    ('other', 'その他', 150)
) AS source (
  evidence_type_code,
  evidence_type_name,
  sort_order
)
WHERE NOT EXISTS (
  SELECT 1
  FROM expenses.evidence_types target
  WHERE target.evidence_type_code =
        source.evidence_type_code
);

COMMIT;