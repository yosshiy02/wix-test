BEGIN;

CREATE TABLE IF NOT EXISTS expenses."contract_insurance_lease_kinds" (
  "contract_insurance_lease_kind_id" BIGSERIAL PRIMARY KEY,
  "contract_insurance_lease_kind_code" VARCHAR(100),
  "contract_insurance_lease_kind_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_contract_insurance_lease_kinds_code"
  ON expenses."contract_insurance_lease_kinds"("contract_insurance_lease_kind_code")
  WHERE "contract_insurance_lease_kind_code" IS NOT NULL
    AND btrim("contract_insurance_lease_kind_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_contract_insurance_lease_kinds_name"
  ON expenses."contract_insurance_lease_kinds"("contract_insurance_lease_kind_name");

INSERT INTO expenses."contract_insurance_lease_kinds" ("contract_insurance_lease_kind_code", "contract_insurance_lease_kind_name", sort_order, is_active)
VALUES
  ('contract', '契約', 10, TRUE),
  ('insurance', '保険', 20, TRUE),
  ('lease', 'リース', 30, TRUE),
  ('mixed', '混在', 90, TRUE),
  ('other', 'その他', 900, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("contract_insurance_lease_kind_name") DO UPDATE
SET
  "contract_insurance_lease_kind_code" = EXCLUDED."contract_insurance_lease_kind_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses."insurance_types" (
  "insurance_type_id" BIGSERIAL PRIMARY KEY,
  "insurance_type_code" VARCHAR(100),
  "insurance_type_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_insurance_types_code"
  ON expenses."insurance_types"("insurance_type_code")
  WHERE "insurance_type_code" IS NOT NULL
    AND btrim("insurance_type_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_insurance_types_name"
  ON expenses."insurance_types"("insurance_type_name");

INSERT INTO expenses."insurance_types" ("insurance_type_code", "insurance_type_name", sort_order, is_active)
VALUES
  ('fire', '火災保険', 10, TRUE),
  ('vehicle', '自動車保険', 20, TRUE),
  ('liability', '賠償責任保険', 30, TRUE),
  ('product_liability', 'PL保険', 40, TRUE),
  ('workers_accident_extra', '労災上乗せ保険', 50, TRUE),
  ('life', '生命保険', 60, TRUE),
  ('medical', '医療保険', 70, TRUE),
  ('cyber', 'サイバー保険', 80, TRUE),
  ('property', '財産保険', 90, TRUE),
  ('other', 'その他', 900, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("insurance_type_name") DO UPDATE
SET
  "insurance_type_code" = EXCLUDED."insurance_type_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses."lease_item_categories" (
  "lease_item_category_id" BIGSERIAL PRIMARY KEY,
  "lease_item_category_code" VARCHAR(100),
  "lease_item_category_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_lease_item_categories_code"
  ON expenses."lease_item_categories"("lease_item_category_code")
  WHERE "lease_item_category_code" IS NOT NULL
    AND btrim("lease_item_category_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_lease_item_categories_name"
  ON expenses."lease_item_categories"("lease_item_category_name");

INSERT INTO expenses."lease_item_categories" ("lease_item_category_code", "lease_item_category_name", sort_order, is_active)
VALUES
  ('vehicle', '車両', 10, TRUE),
  ('machine', '機械設備', 20, TRUE),
  ('it_device', 'IT機器', 30, TRUE),
  ('office_equipment', '事務機器', 40, TRUE),
  ('fixture', '什器備品', 50, TRUE),
  ('store_equipment', '店舗設備', 60, TRUE),
  ('other', 'その他', 900, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("lease_item_category_name") DO UPDATE
SET
  "lease_item_category_code" = EXCLUDED."lease_item_category_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses."contract_types" (
  "contract_type_id" BIGSERIAL PRIMARY KEY,
  "contract_type_code" VARCHAR(100),
  "contract_type_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_contract_types_code"
  ON expenses."contract_types"("contract_type_code")
  WHERE "contract_type_code" IS NOT NULL
    AND btrim("contract_type_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_contract_types_name"
  ON expenses."contract_types"("contract_type_name");

INSERT INTO expenses."contract_types" ("contract_type_code", "contract_type_name", sort_order, is_active)
VALUES
  ('maintenance', '保守契約', 10, TRUE),
  ('rent', '賃貸借契約', 20, TRUE),
  ('service', 'サービス契約', 30, TRUE),
  ('subscription', 'サブスク契約', 40, TRUE),
  ('outsourcing', '業務委託契約', 50, TRUE),
  ('license', 'ライセンス契約', 60, TRUE),
  ('insurance_contract', '保険契約', 70, TRUE),
  ('lease_contract', 'リース契約', 80, TRUE),
  ('other', 'その他', 900, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("contract_type_name") DO UPDATE
SET
  "contract_type_code" = EXCLUDED."contract_type_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses."contract_statuses" (
  "contract_status_id" BIGSERIAL PRIMARY KEY,
  "contract_status_code" VARCHAR(100),
  "contract_status_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_contract_statuses_code"
  ON expenses."contract_statuses"("contract_status_code")
  WHERE "contract_status_code" IS NOT NULL
    AND btrim("contract_status_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_contract_statuses_name"
  ON expenses."contract_statuses"("contract_status_name");

INSERT INTO expenses."contract_statuses" ("contract_status_code", "contract_status_name", sort_order, is_active)
VALUES
  ('active', '有効', 10, TRUE),
  ('pending', '確認中', 20, TRUE),
  ('renewal_pending', '更新確認中', 30, TRUE),
  ('ended', '終了', 40, TRUE),
  ('cancelled', '解約済み', 50, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("contract_status_name") DO UPDATE
SET
  "contract_status_code" = EXCLUDED."contract_status_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses."payment_statuses" (
  "payment_status_id" BIGSERIAL PRIMARY KEY,
  "payment_status_code" VARCHAR(100),
  "payment_status_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_payment_statuses_code"
  ON expenses."payment_statuses"("payment_status_code")
  WHERE "payment_status_code" IS NOT NULL
    AND btrim("payment_status_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_payment_statuses_name"
  ON expenses."payment_statuses"("payment_status_name");

INSERT INTO expenses."payment_statuses" ("payment_status_code", "payment_status_name", sort_order, is_active)
VALUES
  ('unpaid', '未払', 10, TRUE),
  ('scheduled', '支払予定', 20, TRUE),
  ('paid', '支払済み', 30, TRUE),
  ('partially_paid', '一部支払済み', 40, TRUE),
  ('not_applicable', '対象外', 900, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("payment_status_name") DO UPDATE
SET
  "payment_status_code" = EXCLUDED."payment_status_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses."payment_cycles" (
  "payment_cycle_id" BIGSERIAL PRIMARY KEY,
  "payment_cycle_code" VARCHAR(100),
  "payment_cycle_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_payment_cycles_code"
  ON expenses."payment_cycles"("payment_cycle_code")
  WHERE "payment_cycle_code" IS NOT NULL
    AND btrim("payment_cycle_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_payment_cycles_name"
  ON expenses."payment_cycles"("payment_cycle_name");

INSERT INTO expenses."payment_cycles" ("payment_cycle_code", "payment_cycle_name", sort_order, is_active)
VALUES
  ('once', '一回', 10, TRUE),
  ('monthly', '毎月', 20, TRUE),
  ('every_two_months', '2か月ごと', 30, TRUE),
  ('quarterly', '四半期', 40, TRUE),
  ('half_year', '半年', 50, TRUE),
  ('yearly', '年1回', 60, TRUE),
  ('other', 'その他', 900, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("payment_cycle_name") DO UPDATE
SET
  "payment_cycle_code" = EXCLUDED."payment_cycle_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses."company_burden_types" (
  "company_burden_type_id" BIGSERIAL PRIMARY KEY,
  "company_burden_type_code" VARCHAR(100),
  "company_burden_type_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_company_burden_types_code"
  ON expenses."company_burden_types"("company_burden_type_code")
  WHERE "company_burden_type_code" IS NOT NULL
    AND btrim("company_burden_type_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_company_burden_types_name"
  ON expenses."company_burden_types"("company_burden_type_name");

INSERT INTO expenses."company_burden_types" ("company_burden_type_code", "company_burden_type_name", sort_order, is_active)
VALUES
  ('company', '会社負担', 10, TRUE),
  ('personal', '個人負担', 20, TRUE),
  ('mixed', '混在', 30, TRUE),
  ('not_applicable', '対象外', 900, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("company_burden_type_name") DO UPDATE
SET
  "company_burden_type_code" = EXCLUDED."company_burden_type_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses."personal_mix_flags" (
  "personal_mix_flag_id" BIGSERIAL PRIMARY KEY,
  "personal_mix_flag_code" VARCHAR(100),
  "personal_mix_flag_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_personal_mix_flags_code"
  ON expenses."personal_mix_flags"("personal_mix_flag_code")
  WHERE "personal_mix_flag_code" IS NOT NULL
    AND btrim("personal_mix_flag_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_personal_mix_flags_name"
  ON expenses."personal_mix_flags"("personal_mix_flag_name");

INSERT INTO expenses."personal_mix_flags" ("personal_mix_flag_code", "personal_mix_flag_name", sort_order, is_active)
VALUES
  ('none', 'なし', 10, TRUE),
  ('exists', 'あり', 20, TRUE),
  ('unknown', '不明', 900, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("personal_mix_flag_name") DO UPDATE
SET
  "personal_mix_flag_code" = EXCLUDED."personal_mix_flag_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses."payable_registration_types" (
  "payable_registration_type_id" BIGSERIAL PRIMARY KEY,
  "payable_registration_type_code" VARCHAR(100),
  "payable_registration_type_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_payable_registration_types_code"
  ON expenses."payable_registration_types"("payable_registration_type_code")
  WHERE "payable_registration_type_code" IS NOT NULL
    AND btrim("payable_registration_type_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_payable_registration_types_name"
  ON expenses."payable_registration_types"("payable_registration_type_name");

INSERT INTO expenses."payable_registration_types" ("payable_registration_type_code", "payable_registration_type_name", sort_order, is_active)
VALUES
  ('register', '登録する', 10, TRUE),
  ('not_register', '登録しない', 20, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("payable_registration_type_name") DO UPDATE
SET
  "payable_registration_type_code" = EXCLUDED."payable_registration_type_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses."accounts_payable_registration_types" (
  "accounts_payable_registration_type_id" BIGSERIAL PRIMARY KEY,
  "accounts_payable_registration_type_code" VARCHAR(100),
  "accounts_payable_registration_type_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_accounts_payable_registration_types_code"
  ON expenses."accounts_payable_registration_types"("accounts_payable_registration_type_code")
  WHERE "accounts_payable_registration_type_code" IS NOT NULL
    AND btrim("accounts_payable_registration_type_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_accounts_payable_registration_types_name"
  ON expenses."accounts_payable_registration_types"("accounts_payable_registration_type_name");

INSERT INTO expenses."accounts_payable_registration_types" ("accounts_payable_registration_type_code", "accounts_payable_registration_type_name", sort_order, is_active)
VALUES
  ('register', '登録する', 10, TRUE),
  ('not_register', '登録しない', 20, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("accounts_payable_registration_type_name") DO UPDATE
SET
  "accounts_payable_registration_type_code" = EXCLUDED."accounts_payable_registration_type_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses."auto_renewal_types" (
  "auto_renewal_type_id" BIGSERIAL PRIMARY KEY,
  "auto_renewal_type_code" VARCHAR(100),
  "auto_renewal_type_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_auto_renewal_types_code"
  ON expenses."auto_renewal_types"("auto_renewal_type_code")
  WHERE "auto_renewal_type_code" IS NOT NULL
    AND btrim("auto_renewal_type_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_auto_renewal_types_name"
  ON expenses."auto_renewal_types"("auto_renewal_type_name");

INSERT INTO expenses."auto_renewal_types" ("auto_renewal_type_code", "auto_renewal_type_name", sort_order, is_active)
VALUES
  ('yes', 'あり', 10, TRUE),
  ('no', 'なし', 20, TRUE),
  ('unknown', '不明', 900, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("auto_renewal_type_name") DO UPDATE
SET
  "auto_renewal_type_code" = EXCLUDED."auto_renewal_type_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses."ownership_transfer_types" (
  "ownership_transfer_type_id" BIGSERIAL PRIMARY KEY,
  "ownership_transfer_type_code" VARCHAR(100),
  "ownership_transfer_type_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_ownership_transfer_types_code"
  ON expenses."ownership_transfer_types"("ownership_transfer_type_code")
  WHERE "ownership_transfer_type_code" IS NOT NULL
    AND btrim("ownership_transfer_type_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_ownership_transfer_types_name"
  ON expenses."ownership_transfer_types"("ownership_transfer_type_name");

INSERT INTO expenses."ownership_transfer_types" ("ownership_transfer_type_code", "ownership_transfer_type_name", sort_order, is_active)
VALUES
  ('transfer', '所有権移転', 10, TRUE),
  ('non_transfer', '所有権移転外', 20, TRUE),
  ('unknown', '不明', 900, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("ownership_transfer_type_name") DO UPDATE
SET
  "ownership_transfer_type_code" = EXCLUDED."ownership_transfer_type_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS expenses."early_cancellation_types" (
  "early_cancellation_type_id" BIGSERIAL PRIMARY KEY,
  "early_cancellation_type_code" VARCHAR(100),
  "early_cancellation_type_name" TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_early_cancellation_types_code"
  ON expenses."early_cancellation_types"("early_cancellation_type_code")
  WHERE "early_cancellation_type_code" IS NOT NULL
    AND btrim("early_cancellation_type_code"::text) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "ux_early_cancellation_types_name"
  ON expenses."early_cancellation_types"("early_cancellation_type_name");

INSERT INTO expenses."early_cancellation_types" ("early_cancellation_type_code", "early_cancellation_type_name", sort_order, is_active)
VALUES
  ('allowed', '可能', 10, TRUE),
  ('not_allowed', '不可', 20, TRUE),
  ('unknown', '不明', 900, TRUE),
  ('needs_review', '要確認', 999, TRUE)
ON CONFLICT ("early_cancellation_type_name") DO UPDATE
SET
  "early_cancellation_type_code" = EXCLUDED."early_cancellation_type_code",
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

COMMIT;
