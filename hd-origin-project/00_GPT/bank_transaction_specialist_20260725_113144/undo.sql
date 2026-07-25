BEGIN;

DELETE FROM accounting.ai_prompt_compositions
WHERE specialist_analysis_id = (
    SELECT specialist_analysis_id
    FROM accounting.payment_document_specialist_analyses
    WHERE specialist_analysis_code = 'bank_transaction'
);

DELETE FROM accounting.ai_prompt_definitions
WHERE prompt_code IN (
    'stage3_bank_transaction_system',
    'stage3_bank_transaction_fields',
    'stage3_bank_transaction_rules',
    'stage3_bank_transaction_examples'
);

DELETE FROM accounting.specialist_analysis_items
WHERE specialist_analysis_id = (
    SELECT specialist_analysis_id
    FROM accounting.payment_document_specialist_analyses
    WHERE specialist_analysis_code = 'bank_transaction'
);

DELETE FROM accounting.analysis_items
WHERE analysis_item_code IN (
    'bank_document_kind',
    'bank_transaction_direction',
    'bank_transaction_date',
    'bank_value_date',
    'bank_transaction_reference',
    'bank_counterparty_name',
    'bank_opening_balance',
    'bank_closing_balance',
    'bank_available_balance',
    'bank_debit_total',
    'bank_credit_total',
    'bank_transfer_amount',
    'bank_transfer_fee_amount',
    'bank_interest_amount',
    'bank_principal_amount',
    'bank_repayment_amount',
    'bank_loan_balance',
    'bank_instrument_number',
    'bank_maturity_date',
    'bank_settlement_date',
    'bank_dishonor_reason',
    'bank_transaction_count',
    'bank_transactions_json'
);

DELETE FROM accounting.payment_document_types
WHERE document_type_code IN (
    'bank_transfer_receipt',
    'bank_account_statement',
    'direct_debit_notice',
    'bank_deposit_notice',
    'bank_balance_certificate',
    'bank_fee_interest_notice',
    'loan_repayment_statement',
    'bill_check_settlement_notice'
);

DELETE FROM accounting.payment_document_specialist_analyses
WHERE specialist_analysis_code = 'bank_transaction';

COMMIT;