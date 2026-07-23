BEGIN;

WITH master_ids AS (
    SELECT
        (
            SELECT analysis_item_category_id
            FROM accounting.analysis_item_categories
            WHERE analysis_item_category_code = 'specialist'
              AND is_active = true
        ) AS category_id,

        (
            SELECT analysis_data_type_id
            FROM accounting.analysis_data_types
            WHERE analysis_data_type_code = 'integer'
              AND is_active = true
        ) AS integer_type_id,

        (
            SELECT analysis_storage_method_id
            FROM accounting.analysis_storage_methods
            WHERE analysis_storage_method_code = 'json'
              AND is_active = true
        ) AS storage_method_id
)
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
    'tax_category_id',
    '税区分ID',
    NULL,
    category_id,
    integer_type_id,
    storage_method_id,
    NULL,
    NULL,
    false,
    false,
    false,
    false,
    false,
    (
        SELECT COALESCE(MAX(display_order), 0) + 1
        FROM accounting.analysis_items
    ),
    true,
    'expenses.tax_categoriesから選択した税区分マスタID。'
FROM master_ids
WHERE category_id IS NOT NULL
  AND integer_type_id IS NOT NULL
  AND storage_method_id IS NOT NULL
ON CONFLICT (analysis_item_code)
DO UPDATE SET
    analysis_item_name =
        EXCLUDED.analysis_item_name,

    analysis_item_category_id =
        EXCLUDED.analysis_item_category_id,

    analysis_data_type_id =
        EXCLUDED.analysis_data_type_id,

    analysis_storage_method_id =
        EXCLUDED.analysis_storage_method_id,

    is_multiple = false,
    is_active = true,

    description =
        EXCLUDED.description,

    updated_at =
        CURRENT_TIMESTAMP;

UPDATE accounting.analysis_item_child_properties AS child_map
SET
    is_active = false,
    updated_at = CURRENT_TIMESTAMP
FROM accounting.analysis_items AS parent_item,
     accounting.analysis_items AS child_item
WHERE child_map.parent_analysis_item_id =
      parent_item.analysis_item_id

  AND child_map.child_analysis_item_id =
      child_item.analysis_item_id

  AND parent_item.analysis_item_code =
      'line_items'

  AND child_item.analysis_item_code =
      'tax_category_code';

WITH parent_item AS (
    SELECT analysis_item_id
    FROM accounting.analysis_items
    WHERE analysis_item_code = 'line_items'
      AND is_active = true
),
child_item AS (
    SELECT analysis_item_id
    FROM accounting.analysis_items
    WHERE analysis_item_code = 'tax_category_id'
      AND is_active = true
)
INSERT INTO accounting.analysis_item_child_properties (
    parent_analysis_item_id,
    child_analysis_item_id,
    is_required,
    display_order,
    extraction_instruction,
    is_active
)
SELECT
    parent_item.analysis_item_id,
    child_item.analysis_item_id,
    false,
    9,
    '税区分マスタ候補から判断できる場合だけ、対応するtax_category_idを整数で返す。判断不能ならnullとする。',
    true
FROM parent_item
CROSS JOIN child_item
ON CONFLICT (
    parent_analysis_item_id,
    child_analysis_item_id
)
DO UPDATE SET
    is_required = false,
    display_order = 9,

    extraction_instruction =
        EXCLUDED.extraction_instruction,

    is_active = true,
    updated_at = CURRENT_TIMESTAMP;

UPDATE accounting.specialist_analysis_items AS mapping
SET
    extraction_instruction =
        'OCR本文に印字された料金内訳を行ごとに抽出する。各行はline_no、item_name、description、usage_quantity、usage_unit、unit_price、subtotal_amount、tax_category_id、tax_category_label、tax_rate、tax_amount、total_amount、source_textを持つ。税区分は提示されたマスタ候補から選択し、読めない値は推測せず空欄またはnullとする。',

    updated_at =
        CURRENT_TIMESTAMP
FROM accounting.analysis_items AS item,
     accounting.payment_document_specialist_analyses AS specialist
WHERE mapping.analysis_item_id =
      item.analysis_item_id

  AND mapping.specialist_analysis_id =
      specialist.specialist_analysis_id

  AND item.analysis_item_code =
      'line_items'

  AND specialist.specialist_analysis_code =
      'utility_communication';

COMMIT;