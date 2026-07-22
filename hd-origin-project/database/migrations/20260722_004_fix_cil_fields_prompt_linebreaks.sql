BEGIN;

DO $$
DECLARE
  v_updated integer;
  v_prompt text;
BEGIN
  UPDATE accounting.ai_prompt_definitions
  SET
    prompt_text = replace(
      prompt_text,
      E'- 残価\\n- 残価保証額\\n- 物件所在地',
      E'- 残価\n- 残価保証額\n- 物件所在地'
    ),
    updated_at = now()
  WHERE prompt_name =
      'stage3-specialist/contract-insurance-lease/fields.txt'
    AND is_active = TRUE
    AND position(
      E'- 残価\\n- 残価保証額\\n- 物件所在地'
      IN prompt_text
    ) > 0;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> 1 THEN
    RAISE EXCEPTION
      '契約・保険・リースfieldsプロンプトの更新件数が不正です。COUNT=%',
      v_updated;
  END IF;

  SELECT prompt_text
  INTO v_prompt
  FROM accounting.ai_prompt_definitions
  WHERE prompt_name =
      'stage3-specialist/contract-insurance-lease/fields.txt'
    AND is_active = TRUE;

  IF position(
    E'- 残価\\n- 残価保証額\\n- 物件所在地'
    IN v_prompt
  ) > 0 THEN
    RAISE EXCEPTION
      '文字列のバックスラッシュnが残っています。';
  END IF;

  IF position(
    E'- 残価\n- 残価保証額\n- 物件所在地'
    IN v_prompt
  ) = 0 THEN
    RAISE EXCEPTION
      '正常な3行への変換を確認できません。';
  END IF;
END
$$;

COMMIT;