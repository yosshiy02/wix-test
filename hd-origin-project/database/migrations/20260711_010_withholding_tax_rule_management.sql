BEGIN;

CREATE OR REPLACE FUNCTION
  accounting.set_company_withholding_tax_rule_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  trg_company_withholding_tax_rule_updated_at
ON accounting.company_withholding_tax_rules;

CREATE TRIGGER
  trg_company_withholding_tax_rule_updated_at
BEFORE UPDATE
ON accounting.company_withholding_tax_rules
FOR EACH ROW
EXECUTE FUNCTION
  accounting.set_company_withholding_tax_rule_updated_at();

CREATE OR REPLACE FUNCTION
  accounting.calculate_withholding_tax_due_date_by_rule(
    p_recognition_date DATE,
    p_payment_cycle_code TEXT,
    p_special_approval_status_code TEXT,
    p_special_applies BOOLEAN
  )
RETURNS TABLE (
  raw_due_date DATE,
  calculated_due_date DATE,
  applied_rule_code TEXT,
  calendar_complete BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_raw_due_date DATE;
  v_due_date DATE;
  v_rule_code TEXT;
  v_calendar_complete BOOLEAN;
  v_use_special BOOLEAN;
BEGIN
  IF p_recognition_date IS NULL THEN
    RETURN QUERY
    SELECT
      NULL::DATE,
      NULL::DATE,
      'recognition_date_missing'::TEXT,
      FALSE;

    RETURN;
  END IF;

  v_use_special :=
    COALESCE(
      p_payment_cycle_code,
      'normal'
    ) = 'special'

    AND COALESCE(
      p_special_approval_status_code,
      'not_approved'
    ) = 'approved'

    AND COALESCE(
      p_special_applies,
      FALSE
    ) = TRUE;

  IF v_use_special THEN
    IF
      EXTRACT(
        MONTH FROM p_recognition_date
      ) BETWEEN 1 AND 6
    THEN
      v_raw_due_date :=
        make_date(
          EXTRACT(
            YEAR FROM p_recognition_date
          )::INTEGER,
          7,
          10
        );

      v_rule_code :=
        'special_january_to_june';
    ELSE
      v_raw_due_date :=
        make_date(
          EXTRACT(
            YEAR FROM p_recognition_date
          )::INTEGER + 1,
          1,
          20
        );

      v_rule_code :=
        'special_july_to_december';
    END IF;
  ELSE
    v_raw_due_date :=
      (
        date_trunc(
          'month',
          p_recognition_date
        )
        + INTERVAL '1 month'
        + INTERVAL '9 days'
      )::DATE;

    v_rule_code :=
      'normal_next_month_tenth';
  END IF;

  SELECT
    COALESCE(
      y.is_complete,
      FALSE
    )
  INTO
    v_calendar_complete
  FROM
    system.japan_holiday_calendar_years y
  WHERE
    y.calendar_year =
      EXTRACT(
        YEAR FROM v_raw_due_date
      )::INTEGER;

  IF NOT COALESCE(
    v_calendar_complete,
    FALSE
  ) THEN
    RETURN QUERY
    SELECT
      v_raw_due_date,
      NULL::DATE,
      v_rule_code,
      FALSE;

    RETURN;
  END IF;

  v_due_date :=
    accounting.next_japan_business_day(
      v_raw_due_date
    );

  RETURN QUERY
  SELECT
    v_raw_due_date,
    v_due_date,
    v_rule_code,
    TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION
  accounting.preview_company_withholding_tax_due_date(
    p_company_id BIGINT,
    p_recognition_date DATE
  )
RETURNS TABLE (
  company_id BIGINT,
  payment_cycle_code TEXT,
  special_approval_status_code TEXT,
  special_applies BOOLEAN,
  raw_due_date DATE,
  calculated_due_date DATE,
  applied_rule_code TEXT,
  calendar_complete BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p_company_id,

    COALESCE(
      r.payment_cycle_code,
      'normal'
    ),

    COALESCE(
      r.special_approval_status_code,
      'not_approved'
    ),

    COALESCE(
      r.special_applies_to_payable_withholding,
      FALSE
    ),

    d.raw_due_date,
    d.calculated_due_date,
    d.applied_rule_code,
    d.calendar_complete

  FROM (
    SELECT
      p_company_id AS company_id
  ) x

  LEFT JOIN
    accounting.company_withholding_tax_rules r
    ON r.company_id = x.company_id

  CROSS JOIN LATERAL
    accounting.calculate_withholding_tax_due_date_by_rule(
      p_recognition_date,

      COALESCE(
        r.payment_cycle_code,
        'normal'
      ),

      COALESCE(
        r.special_approval_status_code,
        'not_approved'
      ),

      COALESCE(
        r.special_applies_to_payable_withholding,
        FALSE
      )
    ) d;
$$;

COMMENT ON FUNCTION
  accounting.calculate_withholding_tax_due_date_by_rule(
    DATE,
    TEXT,
    TEXT,
    BOOLEAN
  )
IS
  '会社データを書き換えず、指定された源泉所得税ルールで納期限を算定する純粋関数。';

COMMENT ON FUNCTION
  accounting.preview_company_withholding_tax_due_date(
    BIGINT,
    DATE
  )
IS
  '会社別源泉所得税ルールによる納期限を保存せずにプレビューする。';

COMMIT;