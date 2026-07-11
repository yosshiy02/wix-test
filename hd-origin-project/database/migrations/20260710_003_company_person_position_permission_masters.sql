BEGIN;

CREATE TABLE IF NOT EXISTS expenses.companies (
  company_id BIGSERIAL PRIMARY KEY,
  company_code TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS companies_company_code_uidx
ON expenses.companies(company_code);

CREATE UNIQUE INDEX IF NOT EXISTS companies_company_name_uidx
ON expenses.companies(company_name);

CREATE TABLE IF NOT EXISTS expenses.people (
  person_id BIGSERIAL PRIMARY KEY,
  person_code TEXT NOT NULL,
  person_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS people_person_code_uidx
ON expenses.people(person_code);

CREATE UNIQUE INDEX IF NOT EXISTS people_person_name_uidx
ON expenses.people(person_name);

CREATE TABLE IF NOT EXISTS expenses.positions (
  position_id BIGSERIAL PRIMARY KEY,
  position_code TEXT NOT NULL,
  position_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS positions_position_code_uidx
ON expenses.positions(position_code);

CREATE UNIQUE INDEX IF NOT EXISTS positions_position_name_uidx
ON expenses.positions(position_name);

CREATE TABLE IF NOT EXISTS expenses.permissions (
  permission_id BIGSERIAL PRIMARY KEY,
  permission_code TEXT NOT NULL,
  permission_name TEXT NOT NULL,
  permission_level INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS permissions_permission_code_uidx
ON expenses.permissions(permission_code);

CREATE UNIQUE INDEX IF NOT EXISTS permissions_permission_name_uidx
ON expenses.permissions(permission_name);

INSERT INTO expenses.companies
  (company_code, company_name, company_type, sort_order)
VALUES
  ('HATO_DAIYA', '株式会社ハトダイヤ', '株式会社', 10),
  ('HD_ORIGIN_STYLE', '株式会社HDオリジンスタイル', '株式会社', 20),
  ('SAKAGUCHI_KATSUYASU_SHOTEN', '有限会社坂口勝康商店', '有限会社', 30)
ON CONFLICT (company_code)
DO UPDATE SET
  company_name = EXCLUDED.company_name,
  company_type = EXCLUDED.company_type,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO expenses.people
  (person_code, person_name, sort_order)
VALUES
  ('SAKAGUCHI_YOSHIYASU', '坂口喜康', 10)
ON CONFLICT (person_code)
DO UPDATE SET
  person_name = EXCLUDED.person_name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO expenses.positions
  (position_code, position_name, sort_order)
VALUES
  ('REPRESENTATIVE_DIRECTOR_PRESIDENT', '代表取締役社長', 10),
  ('REPRESENTATIVE_DIRECTOR', '代表取締役', 20),
  ('SENIOR_MANAGING_DIRECTOR', '専務取締役', 30),
  ('MANAGING_DIRECTOR', '常務取締役', 40),
  ('DIRECTOR', '取締役', 50),
  ('EMPLOYEE', '従業員', 90)
ON CONFLICT (position_code)
DO UPDATE SET
  position_name = EXCLUDED.position_name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

INSERT INTO expenses.permissions
  (permission_code, permission_name, permission_level, sort_order)
VALUES
  ('VIEW', '閲覧', 10, 10),
  ('CHECK', '確認', 20, 20),
  ('APPROVE', '承認', 30, 30),
  ('MANAGE', '管理', 40, 40)
ON CONFLICT (permission_code)
DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  permission_level = EXCLUDED.permission_level,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

COMMIT;
