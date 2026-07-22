BEGIN;

UPDATE accounting.ai_prompt_definitions
SET prompt_text = prompt_text || '
HD_ORIGIN_CIL_LEASE_ITEM_LINES_20260722_START

9. リース物件明細 lease_item_lines

- OCR本文からリース物件を1件以上識別できる場合、JSON最上位に lease_item_lines 配列を返す。
- lease_item_lines は draft.fields の中へ入れない。
- draft.fields は従来どおり文字列または単純な値だけにする。
- 複数物件は物件ごとに1行ずつ返す。
- 物件を識別できない場合は空配列にする。
- OCR本文にない値は作らず、不明なキーは省略する。
- item_nameを特定できない行は作らない。
- 物件区分はmaster_options.lease_item_categoriesにあるコードと名称だけを使う。
- 区分不明時はneeds_review・要確認を使う。
- 日付はYYYY-MM-DD。
- 金額は円記号・カンマ・単位を除いた数値。
- quantity、lease_period_months、金額、ai_confidenceは数値。
- ai_confidenceは0以上1以下。
- ID、sort_order、is_confirmed、作成日時は返さない。

使用可能キー:
- lease_item_category_code
- lease_item_category_name
- item_name
- manufacturer_name
- model_number
- serial_number
- quantity
- unit_name
- lease_start_date
- lease_end_date
- lease_period_months
- item_location
- monthly_lease_amount
- lease_total_amount
- residual_value_amount
- residual_value_guarantee_amount
- ai_confidence

HD_ORIGIN_CIL_LEASE_ITEM_LINES_20260722_END',
    updated_at = now()
WHERE prompt_name =
  'stage3-specialist/contract-insurance-lease/rules.txt'
  AND is_active = TRUE;

UPDATE accounting.ai_prompt_definitions
SET prompt_text = prompt_text || '
HD_ORIGIN_CIL_LEASE_ITEM_LINES_20260722_START

リース物件明細の追加例:

{
  "lease_item_lines": [
    {
      "lease_item_category_code": "office_equipment",
      "lease_item_category_name": "事務機器",
      "item_name": "デジタル複合機",
      "manufacturer_name": "サンプル株式会社",
      "model_number": "ABC-1234",
      "serial_number": "SN000001",
      "quantity": 1,
      "unit_name": "台",
      "lease_start_date": "2026-07-01",
      "lease_end_date": "2031-06-30",
      "lease_period_months": 60,
      "item_location": "大阪本社",
      "monthly_lease_amount": 33000,
      "lease_total_amount": 1980000,
      "residual_value_amount": 0,
      "residual_value_guarantee_amount": 0,
      "ai_confidence": 0.98
    }
  ]
}

この配列は既存JSONの最上位へ追加する。
draft、visible_field_labels、warningsは従来どおり返す。
物件明細がない場合は "lease_item_lines": [] とする。

HD_ORIGIN_CIL_LEASE_ITEM_LINES_20260722_END',
    updated_at = now()
WHERE prompt_name =
  'stage3-specialist/contract-insurance-lease/examples.txt'
  AND is_active = TRUE;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM accounting.ai_prompt_definitions
  WHERE prompt_name IN (
    'stage3-specialist/contract-insurance-lease/rules.txt',
    'stage3-specialist/contract-insurance-lease/examples.txt'
  )
    AND is_active = TRUE
    AND prompt_text LIKE
      '%HD_ORIGIN_CIL_LEASE_ITEM_LINES_20260722_START%';

  IF v_count <> 2 THEN
    RAISE EXCEPTION
      'lease_item_lines適用件数が不正です。COUNT=%',
      v_count;
  END IF;
END
$$;

COMMIT;