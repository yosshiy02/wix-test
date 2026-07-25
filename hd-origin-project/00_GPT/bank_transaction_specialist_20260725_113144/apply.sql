BEGIN;

INSERT INTO accounting.payment_document_specialist_analyses (
    specialist_analysis_code,
    specialist_analysis_name,
    display_order,
    is_active,
    description,
    created_at,
    updated_at
)
SELECT
    'bank_transaction',
    '銀行取引',
    9,
    true,
    '銀行から届いた振込・入出金・口座振替・残高・借入返済・手数料・利息・手形小切手等の書類を解析します',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1
    FROM accounting.payment_document_specialist_analyses
    WHERE specialist_analysis_code = 'bank_transaction'
);

UPDATE accounting.payment_document_specialist_analyses
SET
    specialist_analysis_name = '銀行取引',
    display_order = 9,
    is_active = true,
    description =
        '銀行から届いた振込・入出金・口座振替・残高・借入返済・手数料・利息・手形小切手等の書類を解析します',
    updated_at = CURRENT_TIMESTAMP
WHERE specialist_analysis_code = 'bank_transaction';

INSERT INTO accounting.payment_document_types (
    document_type_code,
    document_type_name,
    display_order,
    is_active,
    description,
    created_at,
    updated_at
)
SELECT
    source.document_type_code,
    source.document_type_name,
    source.display_order,
    true,
    source.description,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    VALUES
        (
            'bank_transfer_receipt',
            '振込受付書・振込明細票',
            25,
            '銀行窓口・ATM・インターネットバンキング等の振込完了を示す書類'
        ),
        (
            'bank_account_statement',
            '銀行口座取引明細',
            26,
            '通帳・当座勘定照合表・Web入出金明細等'
        ),
        (
            'direct_debit_notice',
            '口座振替・引落通知',
            27,
            '口座振替結果・引落通知・振替不能通知等'
        ),
        (
            'bank_deposit_notice',
            '振込入金・入金通知',
            28,
            '振込入金明細・入金通知等'
        ),
        (
            'bank_balance_certificate',
            '残高証明書',
            29,
            '預金残高証明書・残高報告書等'
        ),
        (
            'bank_fee_interest_notice',
            '銀行手数料・利息通知',
            30,
            '振込手数料・受取利息・支払利息等の通知'
        ),
        (
            'loan_repayment_statement',
            '借入・返済明細',
            31,
            '借入金返済予定表・融資返済明細・利息計算書等'
        ),
        (
            'bill_check_settlement_notice',
            '手形・小切手決済通知',
            32,
            '手形・小切手の決済明細・不渡通知等'
        )
) AS source (
    document_type_code,
    document_type_name,
    display_order,
    description
)
WHERE NOT EXISTS (
    SELECT 1
    FROM accounting.payment_document_types existing
    WHERE existing.document_type_code = source.document_type_code
);

UPDATE accounting.payment_document_types target
SET
    document_type_name = source.document_type_name,
    display_order = source.display_order,
    is_active = true,
    description = source.description,
    updated_at = CURRENT_TIMESTAMP
FROM (
    VALUES
        (
            'bank_transfer_receipt',
            '振込受付書・振込明細票',
            25,
            '銀行窓口・ATM・インターネットバンキング等の振込完了を示す書類'
        ),
        (
            'bank_account_statement',
            '銀行口座取引明細',
            26,
            '通帳・当座勘定照合表・Web入出金明細等'
        ),
        (
            'direct_debit_notice',
            '口座振替・引落通知',
            27,
            '口座振替結果・引落通知・振替不能通知等'
        ),
        (
            'bank_deposit_notice',
            '振込入金・入金通知',
            28,
            '振込入金明細・入金通知等'
        ),
        (
            'bank_balance_certificate',
            '残高証明書',
            29,
            '預金残高証明書・残高報告書等'
        ),
        (
            'bank_fee_interest_notice',
            '銀行手数料・利息通知',
            30,
            '振込手数料・受取利息・支払利息等の通知'
        ),
        (
            'loan_repayment_statement',
            '借入・返済明細',
            31,
            '借入金返済予定表・融資返済明細・利息計算書等'
        ),
        (
            'bill_check_settlement_notice',
            '手形・小切手決済通知',
            32,
            '手形・小切手の決済明細・不渡通知等'
        )
) AS source (
    document_type_code,
    document_type_name,
    display_order,
    description
)
WHERE target.document_type_code = source.document_type_code;

WITH item_source AS (
    SELECT *
    FROM (
        VALUES
            (
                'bank_document_kind',
                '銀行書類区分',
                '銀行書類区分',
                'text',
                'normal_column',
                false,
                true,
                false,
                false,
                false,
                100,
                '銀行書類の種類を文書種別マスタ候補から判定した結果'
            ),
            (
                'bank_transaction_direction',
                '入出金区分',
                '入出金区分',
                'text',
                'normal_column',
                false,
                true,
                false,
                false,
                true,
                101,
                '入金・出金・振替・残高のみ等の区分'
            ),
            (
                'bank_transaction_date',
                '銀行取引日',
                '銀行取引日',
                'date',
                'normal_column',
                false,
                true,
                false,
                false,
                true,
                102,
                '銀行取引が実行または記帳された日'
            ),
            (
                'bank_value_date',
                '銀行起算日',
                '銀行起算日',
                'date',
                'normal_column',
                false,
                false,
                false,
                false,
                true,
                103,
                '利息計算等に使用される起算日'
            ),
            (
                'bank_transaction_reference',
                '銀行取引参照番号',
                '銀行取引参照番号',
                'text',
                'normal_column',
                false,
                true,
                false,
                false,
                true,
                104,
                '振込受付番号・取引番号・照会番号等'
            ),
            (
                'bank_counterparty_name',
                '銀行取引相手先',
                '銀行取引相手先',
                'text',
                'normal_column',
                false,
                true,
                false,
                false,
                true,
                105,
                '振込先・振込元・引落先等の取引相手名称'
            ),
            (
                'bank_opening_balance',
                '期首・開始残高',
                '期首開始残高',
                'currency',
                'normal_column',
                false,
                true,
                true,
                false,
                true,
                106,
                '明細対象期間の開始残高'
            ),
            (
                'bank_closing_balance',
                '期末・終了残高',
                '期末終了残高',
                'currency',
                'normal_column',
                false,
                true,
                true,
                false,
                true,
                107,
                '明細対象期間の終了残高'
            ),
            (
                'bank_available_balance',
                '利用可能残高',
                '利用可能残高',
                'currency',
                'normal_column',
                false,
                true,
                true,
                false,
                true,
                108,
                '書類に印字された利用可能残高'
            ),
            (
                'bank_debit_total',
                '出金合計',
                '出金合計',
                'currency',
                'normal_column',
                false,
                true,
                true,
                false,
                true,
                109,
                '対象期間の出金合計'
            ),
            (
                'bank_credit_total',
                '入金合計',
                '入金合計',
                'currency',
                'normal_column',
                false,
                true,
                true,
                false,
                true,
                110,
                '対象期間の入金合計'
            ),
            (
                'bank_transfer_amount',
                '振込金額',
                '振込金額',
                'currency',
                'normal_column',
                false,
                true,
                true,
                false,
                true,
                111,
                '振込元本の金額'
            ),
            (
                'bank_transfer_fee_amount',
                '銀行手数料金額',
                '銀行手数料金額',
                'currency',
                'normal_column',
                false,
                true,
                true,
                false,
                true,
                112,
                '振込手数料・取扱手数料等'
            ),
            (
                'bank_interest_amount',
                '利息金額',
                '利息金額',
                'currency',
                'normal_column',
                false,
                true,
                true,
                false,
                true,
                113,
                '受取利息または支払利息'
            ),
            (
                'bank_principal_amount',
                '借入元本金額',
                '借入元本金額',
                'currency',
                'normal_column',
                false,
                true,
                true,
                false,
                true,
                114,
                '借入・返済書類に記載された元本金額'
            ),
            (
                'bank_repayment_amount',
                '返済金額',
                '返済金額',
                'currency',
                'normal_column',
                false,
                true,
                true,
                false,
                true,
                115,
                '元本と利息を含む返済金額'
            ),
            (
                'bank_loan_balance',
                '借入残高',
                '借入残高',
                'currency',
                'normal_column',
                false,
                true,
                true,
                false,
                true,
                116,
                '返済後または基準日時点の借入残高'
            ),
            (
                'bank_instrument_number',
                '手形・小切手番号',
                '手形小切手番号',
                'text',
                'normal_column',
                false,
                true,
                false,
                false,
                true,
                117,
                '手形番号・小切手番号'
            ),
            (
                'bank_maturity_date',
                '手形満期日',
                '手形満期日',
                'date',
                'normal_column',
                false,
                true,
                false,
                false,
                true,
                118,
                '手形の満期日'
            ),
            (
                'bank_settlement_date',
                '銀行決済日',
                '銀行決済日',
                'date',
                'normal_column',
                false,
                true,
                false,
                false,
                true,
                119,
                '手形・小切手等の決済日'
            ),
            (
                'bank_dishonor_reason',
                '不渡・不能理由',
                '不渡不能理由',
                'long_text',
                'normal_column',
                false,
                true,
                false,
                false,
                true,
                120,
                '不渡・振替不能・組戻し等の理由'
            ),
            (
                'bank_transaction_count',
                '銀行取引件数',
                '銀行取引件数',
                'integer',
                'normal_column',
                false,
                true,
                true,
                false,
                true,
                121,
                '明細に含まれる取引件数'
            ),
            (
                'bank_transactions_json',
                '銀行取引明細',
                NULL,
                'json',
                'json',
                true,
                true,
                false,
                false,
                true,
                122,
                '銀行取引明細を行単位のJSON配列で保持する'
            )
    ) AS values_table (
        analysis_item_code,
        analysis_item_name,
        normal_column_candidate_name,
        analysis_data_type_code,
        analysis_storage_method_code,
        is_multiple,
        is_searchable,
        is_aggregatable,
        is_standard_extract,
        is_reconcilable,
        display_order,
        description
    )
)
INSERT INTO accounting.analysis_items (
    analysis_item_code,
    analysis_item_name,
    normal_column_candidate_name,
    analysis_item_category_id,
    analysis_data_type_id,
    analysis_storage_method_id,
    is_multiple,
    is_standard_extract,
    is_searchable,
    is_aggregatable,
    is_reconcilable,
    display_order,
    is_active,
    description,
    created_at,
    updated_at
)
SELECT
    source.analysis_item_code,
    source.analysis_item_name,
    source.normal_column_candidate_name,
    category.analysis_item_category_id,
    data_type.analysis_data_type_id,
    storage_method.analysis_storage_method_id,
    source.is_multiple,
    source.is_standard_extract,
    source.is_searchable,
    source.is_aggregatable,
    source.is_reconcilable,
    source.display_order,
    true,
    source.description,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM item_source source
JOIN accounting.analysis_item_categories category
  ON category.analysis_item_category_code = 'specialist'
JOIN accounting.analysis_data_types data_type
  ON data_type.analysis_data_type_code =
     source.analysis_data_type_code
JOIN accounting.analysis_storage_methods storage_method
  ON storage_method.analysis_storage_method_code =
     source.analysis_storage_method_code
WHERE NOT EXISTS (
    SELECT 1
    FROM accounting.analysis_items existing
    WHERE existing.analysis_item_code =
          source.analysis_item_code
);

WITH item_source AS (
    SELECT *
    FROM (
        VALUES
            ('bank_document_kind', '銀行書類区分', '銀行書類区分', 'text', 'normal_column', false, true, false, false, false, 100, '銀行書類の種類を文書種別マスタ候補から判定した結果'),
            ('bank_transaction_direction', '入出金区分', '入出金区分', 'text', 'normal_column', false, true, false, false, true, 101, '入金・出金・振替・残高のみ等の区分'),
            ('bank_transaction_date', '銀行取引日', '銀行取引日', 'date', 'normal_column', false, true, false, false, true, 102, '銀行取引が実行または記帳された日'),
            ('bank_value_date', '銀行起算日', '銀行起算日', 'date', 'normal_column', false, false, false, false, true, 103, '利息計算等に使用される起算日'),
            ('bank_transaction_reference', '銀行取引参照番号', '銀行取引参照番号', 'text', 'normal_column', false, true, false, false, true, 104, '振込受付番号・取引番号・照会番号等'),
            ('bank_counterparty_name', '銀行取引相手先', '銀行取引相手先', 'text', 'normal_column', false, true, false, false, true, 105, '振込先・振込元・引落先等の取引相手名称'),
            ('bank_opening_balance', '期首・開始残高', '期首開始残高', 'currency', 'normal_column', false, true, true, false, true, 106, '明細対象期間の開始残高'),
            ('bank_closing_balance', '期末・終了残高', '期末終了残高', 'currency', 'normal_column', false, true, true, false, true, 107, '明細対象期間の終了残高'),
            ('bank_available_balance', '利用可能残高', '利用可能残高', 'currency', 'normal_column', false, true, true, false, true, 108, '書類に印字された利用可能残高'),
            ('bank_debit_total', '出金合計', '出金合計', 'currency', 'normal_column', false, true, true, false, true, 109, '対象期間の出金合計'),
            ('bank_credit_total', '入金合計', '入金合計', 'currency', 'normal_column', false, true, true, false, true, 110, '対象期間の入金合計'),
            ('bank_transfer_amount', '振込金額', '振込金額', 'currency', 'normal_column', false, true, true, false, true, 111, '振込元本の金額'),
            ('bank_transfer_fee_amount', '銀行手数料金額', '銀行手数料金額', 'currency', 'normal_column', false, true, true, false, true, 112, '振込手数料・取扱手数料等'),
            ('bank_interest_amount', '利息金額', '利息金額', 'currency', 'normal_column', false, true, true, false, true, 113, '受取利息または支払利息'),
            ('bank_principal_amount', '借入元本金額', '借入元本金額', 'currency', 'normal_column', false, true, true, false, true, 114, '借入・返済書類に記載された元本金額'),
            ('bank_repayment_amount', '返済金額', '返済金額', 'currency', 'normal_column', false, true, true, false, true, 115, '元本と利息を含む返済金額'),
            ('bank_loan_balance', '借入残高', '借入残高', 'currency', 'normal_column', false, true, true, false, true, 116, '返済後または基準日時点の借入残高'),
            ('bank_instrument_number', '手形・小切手番号', '手形小切手番号', 'text', 'normal_column', false, true, false, false, true, 117, '手形番号・小切手番号'),
            ('bank_maturity_date', '手形満期日', '手形満期日', 'date', 'normal_column', false, true, false, false, true, 118, '手形の満期日'),
            ('bank_settlement_date', '銀行決済日', '銀行決済日', 'date', 'normal_column', false, true, false, false, true, 119, '手形・小切手等の決済日'),
            ('bank_dishonor_reason', '不渡・不能理由', '不渡不能理由', 'long_text', 'normal_column', false, true, false, false, true, 120, '不渡・振替不能・組戻し等の理由'),
            ('bank_transaction_count', '銀行取引件数', '銀行取引件数', 'integer', 'normal_column', false, true, true, false, true, 121, '明細に含まれる取引件数'),
            ('bank_transactions_json', '銀行取引明細', NULL, 'json', 'json', true, true, false, false, true, 122, '銀行取引明細を行単位のJSON配列で保持する')
    ) AS values_table (
        analysis_item_code,
        analysis_item_name,
        normal_column_candidate_name,
        analysis_data_type_code,
        analysis_storage_method_code,
        is_multiple,
        is_searchable,
        is_aggregatable,
        is_standard_extract,
        is_reconcilable,
        display_order,
        description
    )
)
UPDATE accounting.analysis_items target
SET
    analysis_item_name = source.analysis_item_name,
    normal_column_candidate_name =
        source.normal_column_candidate_name,
    analysis_item_category_id =
        category.analysis_item_category_id,
    analysis_data_type_id =
        data_type.analysis_data_type_id,
    analysis_storage_method_id =
        storage_method.analysis_storage_method_id,
    is_multiple = source.is_multiple,
    is_standard_extract = source.is_standard_extract,
    is_searchable = source.is_searchable,
    is_aggregatable = source.is_aggregatable,
    is_reconcilable = source.is_reconcilable,
    display_order = source.display_order,
    is_active = true,
    description = source.description,
    updated_at = CURRENT_TIMESTAMP
FROM item_source source
JOIN accounting.analysis_item_categories category
  ON category.analysis_item_category_code = 'specialist'
JOIN accounting.analysis_data_types data_type
  ON data_type.analysis_data_type_code =
     source.analysis_data_type_code
JOIN accounting.analysis_storage_methods storage_method
  ON storage_method.analysis_storage_method_code =
     source.analysis_storage_method_code
WHERE target.analysis_item_code = source.analysis_item_code;

DELETE FROM accounting.specialist_analysis_items
WHERE specialist_analysis_id = (
    SELECT specialist_analysis_id
    FROM accounting.payment_document_specialist_analyses
    WHERE specialist_analysis_code = 'bank_transaction'
);

WITH mapping_source AS (
    SELECT *
    FROM (
        VALUES
            ('document_number', 1, false, true, '書類番号・証明書番号・明細番号を抽出する'),
            ('reference_number', 2, false, true, '受付番号・照会番号・参照番号を抽出する'),
            ('issuer_name', 3, false, true, '銀行・金融機関等の発行者名称を抽出する'),
            ('recipient_name', 4, false, false, '書類の宛先・口座名義人を抽出する'),
            ('document_date', 5, false, true, '書類の発行日・基準日を抽出する'),
            ('payment_date', 6, false, true, '振込日・引落日・決済日を抽出する'),
            ('period_start', 7, false, false, '取引明細等の対象期間開始日を抽出する'),
            ('period_end', 8, false, false, '取引明細等の対象期間終了日を抽出する'),
            ('total_amount', 9, false, true, '書類上の主金額を抽出する'),
            ('currency_code', 10, false, true, '通貨コードを抽出する'),
            ('payment_method', 11, false, false, '振込・口座振替等の方法を抽出する'),
            ('description_summary', 12, false, true, '銀行書類の内容を簡潔に要約する'),
            ('notes', 13, false, false, '注意事項・備考を抽出する'),
            ('bank_name', 14, false, true, '銀行名・金融機関名を抽出する'),
            ('bank_branch_name', 15, false, true, '支店名を抽出する'),
            ('bank_account_type', 16, false, false, '普通・当座等の口座種別を抽出する'),
            ('bank_account_number_masked', 17, false, true, 'OCR本文に印字された口座番号を抽出する。推測しない'),
            ('bank_account_holder', 18, false, true, '口座名義を抽出する'),
            ('bank_document_kind', 19, false, true, '銀行書類の種類を文書種別マスタ候補に基づいて判定する'),
            ('bank_transaction_direction', 20, false, true, '入金・出金・振替・残高のみ等を判定する'),
            ('bank_transaction_date', 21, false, true, '取引日・記帳日を抽出する'),
            ('bank_value_date', 22, false, false, '起算日が印字されている場合だけ抽出する'),
            ('bank_transaction_reference', 23, false, true, '取引番号・受付番号・照会番号を抽出する'),
            ('bank_counterparty_name', 24, false, true, '振込先・振込元・引落先等を抽出する'),
            ('bank_opening_balance', 25, false, false, '開始残高が印字されている場合に抽出する'),
            ('bank_closing_balance', 26, false, false, '終了残高が印字されている場合に抽出する'),
            ('bank_available_balance', 27, false, false, '利用可能残高が印字されている場合に抽出する'),
            ('bank_debit_total', 28, false, false, '出金合計が印字されている場合に抽出する'),
            ('bank_credit_total', 29, false, false, '入金合計が印字されている場合に抽出する'),
            ('bank_transfer_amount', 30, false, true, '振込元本額を抽出する'),
            ('bank_transfer_fee_amount', 31, false, false, '銀行手数料を抽出する'),
            ('bank_interest_amount', 32, false, false, '受取利息・支払利息を抽出する'),
            ('bank_principal_amount', 33, false, false, '借入返済の元本金額を抽出する'),
            ('bank_repayment_amount', 34, false, false, '返済総額を抽出する'),
            ('bank_loan_balance', 35, false, false, '借入残高を抽出する'),
            ('bank_instrument_number', 36, false, false, '手形番号・小切手番号を抽出する'),
            ('bank_maturity_date', 37, false, false, '手形満期日を抽出する'),
            ('bank_settlement_date', 38, false, false, '銀行決済日を抽出する'),
            ('bank_dishonor_reason', 39, false, false, '不渡・振替不能・組戻し理由を抽出する'),
            ('bank_transaction_count', 40, false, false, '明細行数を数える'),
            ('bank_transactions_json', 41, false, true, '取引日・入出金区分・相手先・摘要・金額・残高・参照番号・原文を行単位で抽出する')
    ) AS values_table (
        analysis_item_code,
        display_order,
        is_required,
        is_recommended,
        extraction_instruction
    )
)
INSERT INTO accounting.specialist_analysis_items (
    specialist_analysis_id,
    analysis_item_id,
    is_required,
    is_recommended,
    display_order,
    confidence_threshold,
    extraction_instruction,
    created_at,
    updated_at
)
SELECT
    specialist.specialist_analysis_id,
    item.analysis_item_id,
    source.is_required,
    source.is_recommended,
    source.display_order,
    0.7000,
    source.extraction_instruction,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM mapping_source source
JOIN accounting.analysis_items item
  ON item.analysis_item_code = source.analysis_item_code
JOIN accounting.payment_document_specialist_analyses specialist
  ON specialist.specialist_analysis_code = 'bank_transaction';

INSERT INTO accounting.ai_prompt_definitions (
    prompt_code,
    prompt_name,
    prompt_role_code,
    prompt_text,
    source_file_name,
    display_order,
    is_active,
    created_at,
    updated_at
)
SELECT
    source.prompt_code,
    source.prompt_name,
    'system',
    source.prompt_text,
    source.source_file_name,
    source.display_order,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    VALUES
        (
            'stage3_bank_transaction_system',
            'stage3-specialist/bank-transaction/system',
            'stage3-specialist/bank-transaction/system.txt',
            900,
            'あなたは銀行取引関係書類の専門解析AIです。
対象は会社へ届いた銀行取引・銀行口座関係書類です。
振込受付書、振込明細票、ATM利用明細、銀行口座取引明細、通帳、当座勘定照合表、口座振替結果、引落通知、振替不能通知、振込入金通知、残高証明書、銀行手数料通知、利息通知、借入返済明細、返済予定表、手形・小切手決済通知等を扱います。

銀行との契約書、融資契約書、担保契約書等の契約本文は契約・保険・リースへ分類してください。
クレジットカード利用明細、デビットカード利用明細、決済代行サービス明細はカード・決済へ分類してください。
請求書・領収書を銀行取引へ無理に分類しないでください。

OCR本文にない情報を作らないでください。
文書種別と出力項目は提示されたDBマスタ候補から選択してください。
Node.js、画面、SQLによる後付け分類を前提にしてはいけません。

固定値:
specialist_analysis_code: bank_transaction
specialist_analysis_name: 銀行取引
analysis_system_code: bank_transaction
analysis_system_label: 銀行取引専門解析'
        ),
        (
            'stage3_bank_transaction_fields',
            'stage3-specialist/bank-transaction/fields',
            'stage3-specialist/bank-transaction/fields.txt',
            910,
            '銀行取引専門解析では、DBのspecialist_analysis_itemsから提示された項目だけを検討してください。

主な共通項目:
document_number
reference_number
issuer_name
recipient_name
document_date
payment_date
period_start
period_end
total_amount
currency_code
payment_method
description_summary
notes
bank_name
bank_branch_name
bank_account_type
bank_account_number_masked
bank_account_holder

銀行専門項目:
bank_document_kind
bank_transaction_direction
bank_transaction_date
bank_value_date
bank_transaction_reference
bank_counterparty_name
bank_opening_balance
bank_closing_balance
bank_available_balance
bank_debit_total
bank_credit_total
bank_transfer_amount
bank_transfer_fee_amount
bank_interest_amount
bank_principal_amount
bank_repayment_amount
bank_loan_balance
bank_instrument_number
bank_maturity_date
bank_settlement_date
bank_dishonor_reason
bank_transaction_count
bank_transactions_json

bank_transactions_jsonは配列とし、各行に可能な範囲で次を含めてください:
line_no
transaction_date
value_date
direction
counterparty_name
description
debit_amount
credit_amount
transaction_amount
fee_amount
balance
reference_number
source_text

書類にない項目は空欄またはnullにしてください。
複数明細を1行へまとめないでください。'
        ),
        (
            'stage3_bank_transaction_rules',
            'stage3-specialist/bank-transaction/rules',
            'stage3-specialist/bank-transaction/rules.txt',
            920,
            '銀行取引専門解析ルール:

1. OCR本文だけを根拠にする。
2. 銀行名、支店名、口座番号、口座名義を推測しない。
3. 入金と出金を逆にしない。
4. 振込金額と振込手数料を分ける。
5. 借入返済では元本、利息、返済総額、返済後残高を混同しない。
6. 残高証明書は取引明細として捏造しない。
7. 通帳・入出金明細は各取引をbank_transactions_jsonへ別行で返す。
8. OCR上で判別不能な借方・貸方表示は無理に入出金へ変換しない。
9. カード利用明細はcard_statementへ送る。
10. 銀行契約書・融資契約書・担保契約書はcontract_insurance_leaseへ送る。
11. 文書種別はDBから提示された候補内だけで選ぶ。
12. 読めない値は空欄またはnullにし、warningsへ理由を書く。
13. 画面側やAPI側の後付け補正を前提にしない。
14. 出力は共通Stage3出力スキーマに従う。'
        ),
        (
            'stage3_bank_transaction_examples',
            'stage3-specialist/bank-transaction/examples',
            'stage3-specialist/bank-transaction/examples.txt',
            930,
            '銀行取引専門解析の判断例:

振込受付書:
document_type_code=bank_transfer_receipt
bank_transaction_direction=出金
bank_transfer_amount=振込元本
bank_transfer_fee_amount=手数料
bank_transaction_reference=受付番号

銀行口座取引明細:
document_type_code=bank_account_statement
period_start=対象期間開始
period_end=対象期間終了
bank_opening_balance=開始残高
bank_closing_balance=終了残高
bank_transactions_json=取引行配列

口座振替結果:
document_type_code=direct_debit_notice
bank_transaction_direction=出金
bank_transaction_date=引落日
bank_counterparty_name=引落先

振込入金通知:
document_type_code=bank_deposit_notice
bank_transaction_direction=入金
bank_counterparty_name=振込元

残高証明書:
document_type_code=bank_balance_certificate
document_date=基準日
bank_closing_balance=証明残高
bank_transactions_json=[]

借入返済明細:
document_type_code=loan_repayment_statement
bank_principal_amount=元本
bank_interest_amount=利息
bank_repayment_amount=返済総額
bank_loan_balance=返済後残高

判別不能な場合:
推測で別書類へ寄せず、needs_review=trueとしてwarningsへ理由を記録する。'
        )
) AS source (
    prompt_code,
    prompt_name,
    source_file_name,
    display_order,
    prompt_text
)
WHERE NOT EXISTS (
    SELECT 1
    FROM accounting.ai_prompt_definitions existing
    WHERE existing.prompt_code = source.prompt_code
);

UPDATE accounting.ai_prompt_definitions target
SET
    prompt_name = source.prompt_name,
    prompt_role_code = 'system',
    prompt_text = source.prompt_text,
    source_file_name = source.source_file_name,
    display_order = source.display_order,
    is_active = true,
    updated_at = CURRENT_TIMESTAMP
FROM (
    VALUES
        (
            'stage3_bank_transaction_system',
            'stage3-specialist/bank-transaction/system',
            'stage3-specialist/bank-transaction/system.txt',
            900,
            'あなたは銀行取引関係書類の専門解析AIです。
対象は会社へ届いた銀行取引・銀行口座関係書類です。
振込受付書、振込明細票、ATM利用明細、銀行口座取引明細、通帳、当座勘定照合表、口座振替結果、引落通知、振替不能通知、振込入金通知、残高証明書、銀行手数料通知、利息通知、借入返済明細、返済予定表、手形・小切手決済通知等を扱います。

銀行との契約書、融資契約書、担保契約書等の契約本文は契約・保険・リースへ分類してください。
クレジットカード利用明細、デビットカード利用明細、決済代行サービス明細はカード・決済へ分類してください。
請求書・領収書を銀行取引へ無理に分類しないでください。

OCR本文にない情報を作らないでください。
文書種別と出力項目は提示されたDBマスタ候補から選択してください。
Node.js、画面、SQLによる後付け分類を前提にしてはいけません。

固定値:
specialist_analysis_code: bank_transaction
specialist_analysis_name: 銀行取引
analysis_system_code: bank_transaction
analysis_system_label: 銀行取引専門解析'
        ),
        (
            'stage3_bank_transaction_fields',
            'stage3-specialist/bank-transaction/fields',
            'stage3-specialist/bank-transaction/fields.txt',
            910,
            '銀行取引専門解析では、DBのspecialist_analysis_itemsから提示された項目だけを検討してください。

主な共通項目:
document_number
reference_number
issuer_name
recipient_name
document_date
payment_date
period_start
period_end
total_amount
currency_code
payment_method
description_summary
notes
bank_name
bank_branch_name
bank_account_type
bank_account_number_masked
bank_account_holder

銀行専門項目:
bank_document_kind
bank_transaction_direction
bank_transaction_date
bank_value_date
bank_transaction_reference
bank_counterparty_name
bank_opening_balance
bank_closing_balance
bank_available_balance
bank_debit_total
bank_credit_total
bank_transfer_amount
bank_transfer_fee_amount
bank_interest_amount
bank_principal_amount
bank_repayment_amount
bank_loan_balance
bank_instrument_number
bank_maturity_date
bank_settlement_date
bank_dishonor_reason
bank_transaction_count
bank_transactions_json

bank_transactions_jsonは配列とし、各行に可能な範囲で次を含めてください:
line_no
transaction_date
value_date
direction
counterparty_name
description
debit_amount
credit_amount
transaction_amount
fee_amount
balance
reference_number
source_text

書類にない項目は空欄またはnullにしてください。
複数明細を1行へまとめないでください。'
        ),
        (
            'stage3_bank_transaction_rules',
            'stage3-specialist/bank-transaction/rules',
            'stage3-specialist/bank-transaction/rules.txt',
            920,
            '銀行取引専門解析ルール:

1. OCR本文だけを根拠にする。
2. 銀行名、支店名、口座番号、口座名義を推測しない。
3. 入金と出金を逆にしない。
4. 振込金額と振込手数料を分ける。
5. 借入返済では元本、利息、返済総額、返済後残高を混同しない。
6. 残高証明書は取引明細として捏造しない。
7. 通帳・入出金明細は各取引をbank_transactions_jsonへ別行で返す。
8. OCR上で判別不能な借方・貸方表示は無理に入出金へ変換しない。
9. カード利用明細はcard_statementへ送る。
10. 銀行契約書・融資契約書・担保契約書はcontract_insurance_leaseへ送る。
11. 文書種別はDBから提示された候補内だけで選ぶ。
12. 読めない値は空欄またはnullにし、warningsへ理由を書く。
13. 画面側やAPI側の後付け補正を前提にしない。
14. 出力は共通Stage3出力スキーマに従う。'
        ),
        (
            'stage3_bank_transaction_examples',
            'stage3-specialist/bank-transaction/examples',
            'stage3-specialist/bank-transaction/examples.txt',
            930,
            '銀行取引専門解析の判断例:

振込受付書:
document_type_code=bank_transfer_receipt
bank_transaction_direction=出金
bank_transfer_amount=振込元本
bank_transfer_fee_amount=手数料
bank_transaction_reference=受付番号

銀行口座取引明細:
document_type_code=bank_account_statement
period_start=対象期間開始
period_end=対象期間終了
bank_opening_balance=開始残高
bank_closing_balance=終了残高
bank_transactions_json=取引行配列

口座振替結果:
document_type_code=direct_debit_notice
bank_transaction_direction=出金
bank_transaction_date=引落日
bank_counterparty_name=引落先

振込入金通知:
document_type_code=bank_deposit_notice
bank_transaction_direction=入金
bank_counterparty_name=振込元

残高証明書:
document_type_code=bank_balance_certificate
document_date=基準日
bank_closing_balance=証明残高
bank_transactions_json=[]

借入返済明細:
document_type_code=loan_repayment_statement
bank_principal_amount=元本
bank_interest_amount=利息
bank_repayment_amount=返済総額
bank_loan_balance=返済後残高

判別不能な場合:
推測で別書類へ寄せず、needs_review=trueとしてwarningsへ理由を記録する。'
        )
) AS source (
    prompt_code,
    prompt_name,
    source_file_name,
    display_order,
    prompt_text
)
WHERE target.prompt_code = source.prompt_code;

DELETE FROM accounting.ai_prompt_compositions
WHERE specialist_analysis_id = (
    SELECT specialist_analysis_id
    FROM accounting.payment_document_specialist_analyses
    WHERE specialist_analysis_code = 'bank_transaction'
)
AND stage_code = 'stage3';

INSERT INTO accounting.ai_prompt_compositions (
    composition_code,
    composition_name,
    stage_code,
    specialist_analysis_id,
    prompt_definition_id,
    sequence_no,
    is_required,
    is_active,
    created_at,
    updated_at
)
SELECT
    'payment_document_stage3_bank_transaction',
    '支払証憑 専門解析 銀行取引',
    'stage3',
    specialist.specialist_analysis_id,
    prompt.prompt_definition_id,
    source.sequence_no,
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    VALUES
        ('stage3_bank_transaction_system', 60),
        ('stage3_bank_transaction_fields', 70),
        ('stage3_bank_transaction_rules', 80),
        ('stage3_bank_transaction_examples', 90)
) AS source (
    prompt_code,
    sequence_no
)
JOIN accounting.ai_prompt_definitions prompt
  ON prompt.prompt_code = source.prompt_code
JOIN accounting.payment_document_specialist_analyses specialist
  ON specialist.specialist_analysis_code = 'bank_transaction';

COMMIT;