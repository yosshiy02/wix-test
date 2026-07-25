BEGIN;

DELETE FROM accounting.ai_prompt_compositions
WHERE specialist_analysis_id = (
    SELECT specialist_analysis_id
    FROM accounting.payment_document_specialist_analyses
    WHERE specialist_analysis_code = 'bank_transaction'
)
AND stage_code = 'stage3';

DELETE FROM accounting.ai_prompt_definitions
WHERE prompt_code IN (
    'stage3_bank_transaction_system',
    'stage3_bank_transaction_fields',
    'stage3_bank_transaction_rules',
    'stage3_bank_transaction_examples'
);

COMMIT;