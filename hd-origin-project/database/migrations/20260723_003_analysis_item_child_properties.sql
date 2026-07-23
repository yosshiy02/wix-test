BEGIN;

CREATE TABLE IF NOT EXISTS accounting.analysis_item_child_properties (
    analysis_item_child_property_id bigint
        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    parent_analysis_item_id bigint NOT NULL,
    child_analysis_item_id bigint NOT NULL,

    is_required boolean NOT NULL DEFAULT false,
    display_order integer NOT NULL DEFAULT 0,
    extraction_instruction text NULL,
    is_active boolean NOT NULL DEFAULT true,

    created_at timestamp with time zone
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at timestamp with time zone
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_analysis_item_child_properties_parent
        FOREIGN KEY (parent_analysis_item_id)
        REFERENCES accounting.analysis_items (
            analysis_item_id
        ),

    CONSTRAINT fk_analysis_item_child_properties_child
        FOREIGN KEY (child_analysis_item_id)
        REFERENCES accounting.analysis_items (
            analysis_item_id
        ),

    CONSTRAINT uq_analysis_item_child_properties_pair
        UNIQUE (
            parent_analysis_item_id,
            child_analysis_item_id
        ),

    CONSTRAINT ck_analysis_item_child_properties_not_self
        CHECK (
            parent_analysis_item_id <>
            child_analysis_item_id
        )
);

CREATE INDEX IF NOT EXISTS
    idx_analysis_item_child_properties_parent
ON accounting.analysis_item_child_properties (
    parent_analysis_item_id,
    display_order
);

WITH master_ids AS (
    SELECT
        (
            SELECT analysis_item_category_id
            FROM accounting.analysis_item_categories
            WHERE analysis_item_category_code = 'specialist'
              AND is_active = true
        ) AS category_id,

        (
            SELECT analysis_storage_method_id
            FROM accounting.analysis_storage_methods
            WHERE analysis_storage_method_code = 'json'
              AND is_active = true
        ) AS storage_method_id,

        (
            SELECT analysis_data_type_id
            FROM accounting.analysis_data_types
            WHERE analysis_data_type_code = 'text'
              AND is_active = true
        ) AS text_type_id,

        (
            SELECT analysis_data_type_id
            FROM accounting.analysis_data_types
            WHERE analysis_data_type_code = 'long_text'
              AND is_active = true
        ) AS long_text_type_id,

        (
            SELECT analysis_data_type_id
            FROM accounting.analysis_data_types
            WHERE analysis_data_type_code = 'integer'
              AND is_active = true
        ) AS integer_type_id,

        (
            SELECT analysis_data_type_id
            FROM accounting.analysis_data_types
            WHERE analysis_data_type_code = 'decimal'
              AND is_active = true
        ) AS decimal_type_id
),
new_items AS (
    SELECT
        'line_no'::varchar AS analysis_item_code,
        '行番号'::varchar AS analysis_item_name,
        integer_type_id AS analysis_data_type_id,
        NULL::integer AS max_length,
        NULL::integer AS decimal_places,
        '明細配列内の表示順を表す行番号。'::text AS description,
        1 AS item_order
    FROM master_ids

    UNION ALL

    SELECT
        'item_name',
        '明細名',
        text_type_id,
        255,
        NULL,
        '料金内訳の名称。',
        2
    FROM master_ids

    UNION ALL

    SELECT
        'description',
        '明細説明',
        long_text_type_id,
        NULL,
        NULL,
        '料金内訳に関する補足説明。',
        3
    FROM master_ids

    UNION ALL

    SELECT
        'unit_price',
        '単価',
        decimal_type_id,
        NULL,
        4,
        'OCR本文に単価が印字されている場合の単価。',
        6
    FROM master_ids

    UNION ALL

    SELECT
        'tax_rate',
        '税率',
        decimal_type_id,
        NULL,
        4,
        'OCR本文に記載された税率。',
        9
    FROM master_ids

    UNION ALL

    SELECT
        'tax_category_code',
        '税区分コード',
        text_type_id,
        100,
        NULL,
        '税区分マスタ候補のコード。',
        10
    FROM master_ids

    UNION ALL

    SELECT
        'tax_category_label',
        '税区分名',
        text_type_id,
        255,
        NULL,
        '税区分マスタ候補の表示名称。',
        11
    FROM master_ids

    UNION ALL

    SELECT
        'source_text',
        'OCR根拠文字列',
        long_text_type_id,
        NULL,
        NULL,
        '各明細を抽出した根拠となるOCR本文。',
        14
    FROM master_ids
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
    ni.analysis_item_code,
    ni.analysis_item_name,
    NULL,
    mi.category_id,
    ni.analysis_data_type_id,
    mi.storage_method_id,
    ni.max_length,
    ni.decimal_places,
    false,
    false,
    false,
    false,
    false,
    (
        SELECT COALESCE(MAX(display_order), 0)
        FROM accounting.analysis_items
    ) + ni.item_order,
    true,
    ni.description
FROM new_items ni
CROSS JOIN master_ids mi
WHERE mi.category_id IS NOT NULL
  AND mi.storage_method_id IS NOT NULL
  AND ni.analysis_data_type_id IS NOT NULL
ON CONFLICT (analysis_item_code)
DO UPDATE SET
    analysis_item_name =
        EXCLUDED.analysis_item_name,

    analysis_data_type_id =
        EXCLUDED.analysis_data_type_id,

    analysis_storage_method_id =
        EXCLUDED.analysis_storage_method_id,

    max_length =
        EXCLUDED.max_length,

    decimal_places =
        EXCLUDED.decimal_places,

    is_multiple = false,
    is_active = true,

    description =
        EXCLUDED.description,

    updated_at =
        CURRENT_TIMESTAMP;

WITH child_definitions AS (
    SELECT *
    FROM (
        VALUES
            (
                'line_no',
                1,
                true,
                '明細配列の先頭から1、2、3の順で行番号を返す。'
            ),
            (
                'item_name',
                2,
                true,
                'OCR本文に印字された料金内訳名称を返す。'
            ),
            (
                'description',
                3,
                false,
                '明細名だけでは不足する場合の補足説明を返す。'
            ),
            (
                'usage_quantity',
                4,
                false,
                '明細単位の使用量が印字されている場合だけ数値で返す。'
            ),
            (
                'usage_unit',
                5,
                false,
                '明細単位の使用量単位が印字されている場合だけ返す。'
            ),
            (
                'unit_price',
                6,
                false,
                '単価が明記されている場合だけ数値で返す。'
            ),
            (
                'subtotal_amount',
                7,
                false,
                '明細の税抜金額または小計が印字されている場合だけ返す。'
            ),
            (
                'tax_rate',
                8,
                false,
                '明細に適用される税率が印字されている場合だけ返す。'
            ),
            (
                'tax_category_code',
                9,
                false,
                'OCR本文と税区分マスタ候補から判断できる場合だけコードを返す。'
            ),
            (
                'tax_category_label',
                10,
                false,
                '税区分コードを返す場合は対応する表示名称を返す。'
            ),
            (
                'tax_amount',
                11,
                false,
                '明細税額が実際に印字されている場合だけ返す。独自計算しない。'
            ),
            (
                'total_amount',
                12,
                false,
                '明細合計が印字されている場合だけ返す。'
            ),
            (
                'source_text',
                13,
                true,
                '明細抽出の根拠となったOCR本文を改変せず返す。'
            )
    ) AS values_table (
        child_code,
        display_order,
        is_required,
        extraction_instruction
    )
),
parent_item AS (
    SELECT analysis_item_id
    FROM accounting.analysis_items
    WHERE analysis_item_code = 'line_items'
      AND is_active = true
),
child_items AS (
    SELECT
        ai.analysis_item_id,
        ai.analysis_item_code
    FROM accounting.analysis_items ai
    WHERE ai.analysis_item_code IN (
        'line_no',
        'item_name',
        'description',
        'usage_quantity',
        'usage_unit',
        'unit_price',
        'subtotal_amount',
        'tax_rate',
        'tax_category_code',
        'tax_category_label',
        'tax_amount',
        'total_amount',
        'source_text'
    )
      AND ai.is_active = true
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
    pi.analysis_item_id,
    ci.analysis_item_id,
    cd.is_required,
    cd.display_order,
    cd.extraction_instruction,
    true
FROM child_definitions cd
JOIN child_items ci
  ON ci.analysis_item_code =
     cd.child_code
CROSS JOIN parent_item pi
ON CONFLICT (
    parent_analysis_item_id,
    child_analysis_item_id
)
DO UPDATE SET
    is_required =
        EXCLUDED.is_required,

    display_order =
        EXCLUDED.display_order,

    extraction_instruction =
        EXCLUDED.extraction_instruction,

    is_active = true,

    updated_at =
        CURRENT_TIMESTAMP;

COMMIT;