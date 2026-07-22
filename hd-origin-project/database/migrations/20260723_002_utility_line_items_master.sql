BEGIN;

WITH master_ids AS (
  SELECT
    (
      SELECT analysis_item_category_id
      FROM accounting.analysis_item_categories
      WHERE analysis_item_category_code = 'specialist'
        AND is_active = TRUE
    ) AS category_id,
    (
      SELECT analysis_data_type_id
      FROM accounting.analysis_data_types
      WHERE analysis_data_type_code = 'json'
        AND is_active = TRUE
    ) AS data_type_id,
    (
      SELECT analysis_storage_method_id
      FROM accounting.analysis_storage_methods
      WHERE analysis_storage_method_code = 'json'
        AND is_active = TRUE
    ) AS storage_method_id
),
upsert_item AS (
  INSERT INTO accounting.analysis_items (
    analysis_item_code,
    analysis_item_name,
    normal_column_candidate_name,
    analysis_item_category_id,
    analysis_data_type_id,
    analysis_storage_method_id,
    max_length,
    decimal_places,
    is_multiple,
    is_standard_extract,
    is_searchable,
    is_aggregatable,
    is_reconcilable,
    display_order,
    is_active,
    description
  )
  SELECT
    'line_items',
    '料金内訳明細',
    NULL,
    category_id,
    data_type_id,
    storage_method_id,
    NULL,
    NULL,
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    COALESCE(
      (SELECT MAX(display_order) + 1 FROM accounting.analysis_items),
      1
    ),
    TRUE,
    '公共料金・通信費の請求内訳を複数行のJSON配列として保持する。'
  FROM master_ids
  WHERE category_id IS NOT NULL
    AND data_type_id IS NOT NULL
    AND storage_method_id IS NOT NULL
  ON CONFLICT (analysis_item_code)
  DO UPDATE SET
    analysis_item_name = EXCLUDED.analysis_item_name,
    analysis_item_category_id = EXCLUDED.analysis_item_category_id,
    analysis_data_type_id = EXCLUDED.analysis_data_type_id,
    analysis_storage_method_id = EXCLUDED.analysis_storage_method_id,
    is_multiple = TRUE,
    is_active = TRUE,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP
  RETURNING analysis_item_id
),
target_item AS (
  SELECT analysis_item_id FROM upsert_item
  UNION ALL
  SELECT analysis_item_id
  FROM accounting.analysis_items
  WHERE analysis_item_code = 'line_items'
  LIMIT 1
)
INSERT INTO accounting.specialist_analysis_items (
  specialist_analysis_id,
  analysis_item_id,
  is_required,
  is_recommended,
  display_order,
  confidence_threshold,
  extraction_instruction,
  is_active
)
SELECT
  psa.specialist_analysis_id,
  ti.analysis_item_id,
  FALSE,
  TRUE,
  6,
  NULL,
  'OCR本文に印字された料金内訳を行ごとに抽出する。各行はline_no、item_name、description、usage_quantity、usage_unit、unit_price、subtotal_amount、tax_rate、tax_category_code、tax_category_label、tax_amount、total_amount、source_textを持つ。読めない値は推測せず空欄またはnullとする。',
  TRUE
FROM accounting.payment_document_specialist_analyses psa
CROSS JOIN target_item ti
WHERE psa.specialist_analysis_code = 'utility_communication'
  AND psa.is_active = TRUE
ON CONFLICT (specialist_analysis_id, analysis_item_id)
DO UPDATE SET
  is_required = FALSE,
  is_recommended = TRUE,
  display_order = 6,
  extraction_instruction = EXCLUDED.extraction_instruction,
  is_active = TRUE,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;