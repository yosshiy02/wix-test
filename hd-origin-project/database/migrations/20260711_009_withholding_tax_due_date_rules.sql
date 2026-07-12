BEGIN;

CREATE TABLE IF NOT EXISTS
  accounting.company_withholding_tax_rules (
    company_id
      BIGINT PRIMARY KEY,

    payment_cycle_code
      TEXT NOT NULL DEFAULT 'normal',

    special_approval_status_code
      TEXT NOT NULL DEFAULT 'not_approved',

    special_applies_to_payable_withholding
      BOOLEAN NOT NULL DEFAULT FALSE,

    effective_from
      DATE NOT NULL DEFAULT DATE '1900-01-01',

    effective_to
      DATE NULL,

    rule_source_code
      TEXT NOT NULL DEFAULT 'system_default_normal',

    memo
      TEXT NOT NULL DEFAULT '',

    created_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT
      company_withholding_tax_rules_cycle_chk
    CHECK (
      payment_cycle_code IN (
        'normal',
        'special'
      )
    ),

    CONSTRAINT
      company_withholding_tax_rules_approval_chk
    CHECK (
      special_approval_status_code IN (
        'not_approved',
        'pending',
        'approved',
        'revoked'
      )
    )
  );

INSERT INTO
  accounting.company_withholding_tax_rules (
    company_id,
    payment_cycle_code,
    special_approval_status_code,
    special_applies_to_payable_withholding,
    rule_source_code,
    memo
  )
SELECT
  c.company_id,
  'normal',
  'not_approved',
  FALSE,
  'system_default_normal',
  '特例承認情報が登録されるまでは通常納付を使用'
FROM expenses.companies c
ON CONFLICT (company_id)
DO NOTHING;

CREATE TABLE IF NOT EXISTS
  system.japan_holidays (
    holiday_date
      DATE PRIMARY KEY,

    holiday_name
      TEXT NOT NULL,

    calendar_year
      INTEGER NOT NULL,

    source_code
      TEXT NOT NULL DEFAULT 'cabinet_office',

    created_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

CREATE TABLE IF NOT EXISTS
  system.japan_holiday_calendar_years (
    calendar_year
      INTEGER PRIMARY KEY,

    is_complete
      BOOLEAN NOT NULL DEFAULT FALSE,

    source_code
      TEXT NOT NULL DEFAULT 'cabinet_office',

    verified_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

INSERT INTO system.japan_holidays (
  holiday_date,
  holiday_name,
  calendar_year
)
VALUES
  ('2026-01-01', '元日', 2026),
  ('2026-01-12', '成人の日', 2026),
  ('2026-02-11', '建国記念の日', 2026),
  ('2026-02-23', '天皇誕生日', 2026),
  ('2026-03-20', '春分の日', 2026),
  ('2026-04-29', '昭和の日', 2026),
  ('2026-05-03', '憲法記念日', 2026),
  ('2026-05-04', 'みどりの日', 2026),
  ('2026-05-05', 'こどもの日', 2026),
  ('2026-05-06', '休日', 2026),
  ('2026-07-20', '海の日', 2026),
  ('2026-08-11', '山の日', 2026),
  ('2026-09-21', '敬老の日', 2026),
  ('2026-09-22', '休日', 2026),
  ('2026-09-23', '秋分の日', 2026),
  ('2026-10-12', 'スポーツの日', 2026),
  ('2026-11-03', '文化の日', 2026),
  ('2026-11-23', '勤労感謝の日', 2026),

  ('2027-01-01', '元日', 2027),
  ('2027-01-11', '成人の日', 2027),
  ('2027-02-11', '建国記念の日', 2027),
  ('2027-02-23', '天皇誕生日', 2027),
  ('2027-03-21', '春分の日', 2027),
  ('2027-03-22', '休日', 2027),
  ('2027-04-29', '昭和の日', 2027),
  ('2027-05-03', '憲法記念日', 2027),
  ('2027-05-04', 'みどりの日', 2027),
  ('2027-05-05', 'こどもの日', 2027),
  ('2027-07-19', '海の日', 2027),
  ('2027-08-11', '山の日', 2027),
  ('2027-09-20', '敬老の日', 2027),
  ('2027-09-23', '秋分の日', 2027),
  ('2027-10-11', 'スポーツの日', 2027),
  ('2027-11-03', '文化の日', 2027),
  ('2027-11-23', '勤労感謝の日', 2027)

ON CONFLICT (holiday_date)
DO UPDATE SET
  holiday_name =
    EXCLUDED.holiday_name,

  calendar_year =
    EXCLUDED.calendar_year,

  source_code =
    EXCLUDED.source_code;

INSERT INTO
  system.japan_holiday_calendar_years (
    calendar_year,
    is_complete,
    source_code,
    verified_at
  )
VALUES
  (2026, TRUE, 'cabinet_office', NOW()),
  (2027, TRUE, 'cabinet_office', NOW())

ON CONFLICT (calendar_year)
DO UPDATE SET
  is_complete =
    EXCLUDED.is_complete,

  source_code =
    EXCLUDED.source_code,

  verified_at =
    EXCLUDED.verified_at;

CREATE OR REPLACE FUNCTION
  accounting.next_japan_business_day(
    p_date DATE
  )
RETURNS DATE
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_date DATE := p_date;
  v_guard INTEGER := 0;
BEGIN
  IF p_date IS NULL THEN
    RETURN NULL;
  END IF;

  LOOP
    v_guard := v_guard + 1;

    IF v_guard > 20 THEN
      RAISE EXCEPTION
        '営業日算定が20日を超えました: %',
        p_date;
    END IF;

    IF
      EXTRACT(ISODOW FROM v_date)
        NOT IN (6, 7)

      AND NOT EXISTS (
        SELECT 1
        FROM system.japan_holidays h
        WHERE h.holiday_date = v_date
      )
    THEN
      RETURN v_date;
    END IF;

    v_date := v_date + 1;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION
  accounting.calculate_withholding_tax_due_dates()
RETURNS TABLE (
  calculated_count INTEGER,
  normal_count INTEGER,
  special_count INTEGER,
  calendar_error_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_row RECORD;
  v_raw_due_date DATE;
  v_due_date DATE;
  v_calendar_complete BOOLEAN;
  v_use_special BOOLEAN;

  v_calculated INTEGER := 0;
  v_normal INTEGER := 0;
  v_special INTEGER := 0;
  v_calendar_error INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT
      o.tax_public_obligation_id,
      o.company_id,
      o.recognition_date,

      COALESCE(
        r.payment_cycle_code,
        'normal'
      ) AS payment_cycle_code,

      COALESCE(
        r.special_approval_status_code,
        'not_approved'
      ) AS special_approval_status_code,

      COALESCE(
        r.special_applies_to_payable_withholding,
        FALSE
      ) AS special_applies,

      COALESCE(
        r.effective_from,
        DATE '1900-01-01'
      ) AS effective_from,

      r.effective_to

    FROM accounting.tax_public_obligations o

    LEFT JOIN
      accounting.company_withholding_tax_rules r
      ON r.company_id = o.company_id

    WHERE
      o.source_type_code =
        'withholding_tax_ledger'

      AND o.status_code =
        'scheduled'

      AND o.recognition_date IS NOT NULL
  LOOP
    v_use_special :=
      v_row.payment_cycle_code =
        'special'

      AND
      v_row.special_approval_status_code =
        'approved'

      AND
      v_row.special_applies =
        TRUE

      AND
      v_row.recognition_date >=
        v_row.effective_from

      AND (
        v_row.effective_to IS NULL
        OR
        v_row.recognition_date <=
          v_row.effective_to
      );

    IF v_use_special THEN
      IF
        EXTRACT(
          MONTH FROM v_row.recognition_date
        ) BETWEEN 1 AND 6
      THEN
        v_raw_due_date :=
          make_date(
            EXTRACT(
              YEAR FROM v_row.recognition_date
            )::INTEGER,
            7,
            10
          );
      ELSE
        v_raw_due_date :=
          make_date(
            EXTRACT(
              YEAR FROM v_row.recognition_date
            )::INTEGER + 1,
            1,
            20
          );
      END IF;

      v_special := v_special + 1;
    ELSE
      v_raw_due_date :=
        (
          date_trunc(
            'month',
            v_row.recognition_date
          )
          + INTERVAL '1 month'
          + INTERVAL '9 days'
        )::DATE;

      v_normal := v_normal + 1;
    END IF;

    SELECT
      COALESCE(
        y.is_complete,
        FALSE
      )
    INTO
      v_calendar_complete
    FROM (
      SELECT
        EXTRACT(
          YEAR FROM v_raw_due_date
        )::INTEGER AS calendar_year
    ) x

    LEFT JOIN
      system.japan_holiday_calendar_years y
      ON y.calendar_year =
        x.calendar_year;

    IF NOT COALESCE(
      v_calendar_complete,
      FALSE
    ) THEN
      UPDATE accounting.tax_public_obligations
      SET
        due_date = NULL,

        machine_validation_status =
          'error',

        machine_validation_message =
          '納期限年の祝日カレンダーが未登録です。',

        updated_at = NOW()

      WHERE
        tax_public_obligation_id =
          v_row.tax_public_obligation_id;

      v_calendar_error :=
        v_calendar_error + 1;

      CONTINUE;
    END IF;

    v_due_date :=
      accounting.next_japan_business_day(
        v_raw_due_date
      );

    UPDATE accounting.tax_public_obligations
    SET
      due_date =
        v_due_date,

      machine_validation_status =
        CASE
          WHEN
            machine_validation_status =
              'error'
            AND
            machine_validation_message IN (
              '納期限ルール未設定。金額と連携元は有効です。',
              '納期限年の祝日カレンダーが未登録です。'
            )
          THEN 'valid'
          ELSE machine_validation_status
        END,

      machine_validation_message =
        CASE
          WHEN
            machine_validation_message IN (
              '納期限ルール未設定。金額と連携元は有効です。',
              '納期限年の祝日カレンダーが未登録です。'
            )
          THEN NULL
          ELSE machine_validation_message
        END,

      updated_at = NOW()

    WHERE
      tax_public_obligation_id =
        v_row.tax_public_obligation_id;

    UPDATE accounting.withholding_tax_ledger
    SET
      tax_public_due_date =
        v_due_date,

      updated_at = NOW()

    WHERE
      withholding_tax_ledger_id = (
        SELECT
          o.source_ledger_id
        FROM accounting.tax_public_obligations o
        WHERE
          o.tax_public_obligation_id =
            v_row.tax_public_obligation_id
      );

    v_calculated :=
      v_calculated + 1;
  END LOOP;

  RETURN QUERY
  SELECT
    v_calculated,
    v_normal,
    v_special,
    v_calendar_error;
END;
$$;

COMMENT ON TABLE
  accounting.company_withholding_tax_rules
IS
  '会社別の源泉所得税納期限ルール。承認済み特例だけを適用する。';

COMMENT ON FUNCTION
  accounting.calculate_withholding_tax_due_dates()
IS
  '源泉所得税の納期限を通常納付または承認済み納期特例で算定し、休日を次営業日へ補正する。';

COMMIT;