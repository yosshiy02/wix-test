DO $migration$
DECLARE
    target_count integer;
BEGIN
    SELECT COUNT(*)
      INTO target_count
      FROM accounting.ai_prompt_definitions
     WHERE prompt_code = 'payment_document_prompt_92bc6ab5a3ead62e15bfdde7bf340cbf'
       AND is_active = TRUE;

    IF target_count <> 1 THEN
        RAISE EXCEPTION '対象プロンプトが1件ではありません。COUNT=%', target_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM accounting.ai_prompt_definitions
         WHERE prompt_code = 'payment_document_prompt_92bc6ab5a3ead62e15bfdde7bf340cbf'
           AND prompt_text LIKE '%残価保証額%'
    ) THEN
        UPDATE accounting.ai_prompt_definitions
           SET prompt_text = regexp_replace(
                   prompt_text,
                   E'- 残価\\r?\\n- 物件所在地',
                   E'- 残価\\n- 残価保証額\\n- 物件所在地'
               ),
               updated_at = CURRENT_TIMESTAMP
         WHERE prompt_code = 'payment_document_prompt_92bc6ab5a3ead62e15bfdde7bf340cbf'
           AND prompt_text ~ E'- 残価\\r?\\n- 物件所在地';

        IF NOT FOUND THEN
            RAISE EXCEPTION '残価と物件所在地の挿入位置が見つかりません。';
        END IF;
    END IF;
END
$migration$;