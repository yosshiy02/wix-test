BEGIN;

UPDATE expenses.receipt_summaries
SET
    receipt_summary_code = 'meal_expense',
    receipt_summary_name = '飲食代',
    description = '飲食店、レストラン、喫茶店、弁当、軽食などの飲食費。会議、接待、出張などの具体的な目的は目的欄やメモ欄で管理する。',
    account_title_hint = NULL,
    updated_at = NOW()
WHERE receipt_summary_code = 'travel_meal';

DO $$
DECLARE
    matched_count INTEGER;
BEGIN
    SELECT COUNT(*)::integer
    INTO matched_count
    FROM expenses.receipt_summaries
    WHERE receipt_summary_code = 'meal_expense'
      AND receipt_summary_name = '飲食代';

    IF matched_count <> 1 THEN
        RAISE EXCEPTION
            '飲食代摘要の更新確認に失敗しました。件数=%',
            matched_count;
    END IF;
END
$$;

COMMIT;