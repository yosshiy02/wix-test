BEGIN;

DO $migration$
DECLARE
  basic_processing_order integer;
  specialist_waiting_order integer;
  completed_order integer;
  formal_status_count integer;
BEGIN
  SELECT display_order
  INTO basic_processing_order
  FROM accounting.payment_document_current_statuses
  WHERE current_status = '基礎解析中'
    AND is_active = TRUE;

  SELECT display_order
  INTO specialist_waiting_order
  FROM accounting.payment_document_current_statuses
  WHERE current_status = '専門解析待ち'
    AND is_active = TRUE;

  IF basic_processing_order IS NULL OR specialist_waiting_order IS NULL THEN
    RAISE EXCEPTION
      '基礎解析中または専門解析待ちの有効なマスタ行がありません。';
  END IF;

  IF specialist_waiting_order - basic_processing_order < 2 THEN
    RAISE EXCEPTION
      '基礎解析済みを追加できるdisplay_orderの空きがありません。';
  END IF;

  completed_order :=
    basic_processing_order +
    ((specialist_waiting_order - basic_processing_order) / 2);

  IF EXISTS (
    SELECT 1
    FROM accounting.payment_document_current_statuses
    WHERE display_order = completed_order
      AND current_status <> '基礎解析済み'
  ) THEN
    RAISE EXCEPTION
      '基礎解析済み用のdisplay_order % は既に使用されています。',
      completed_order;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM accounting.payment_document_current_statuses
    WHERE current_status = '基礎解析済み'
  ) THEN
    UPDATE accounting.payment_document_current_statuses
    SET
      display_order = completed_order,
      is_processing = FALSE,
      is_terminal = FALSE,
      is_error = FALSE,
      is_active = TRUE,
      description = '基礎解析が正常完了し、専門解析への振り分けを待っている状態'
    WHERE current_status = '基礎解析済み';
  ELSE
    INSERT INTO accounting.payment_document_current_statuses (
      current_status,
      display_order,
      is_processing,
      is_terminal,
      is_error,
      is_active,
      description
    ) VALUES (
      '基礎解析済み',
      completed_order,
      FALSE,
      FALSE,
      FALSE,
      TRUE,
      '基礎解析が正常完了し、専門解析への振り分けを待っている状態'
    );
  END IF;

  SELECT COUNT(*)
  INTO formal_status_count
  FROM accounting.payment_document_current_statuses
  WHERE is_active = TRUE
    AND current_status = ANY(ARRAY[
      'OCR待ち',
      'OCR処理中',
      '基礎解析待ち',
      '基礎解析中',
      '基礎解析済み',
      '専門解析待ち',
      '専門解析中',
      '人間確認待ち',
      '台帳',
      'エラー'
    ]);

  IF formal_status_count <> 10 THEN
    RAISE EXCEPTION
      '正式な証憑ステータスマスタが10件揃っていません。count=%',
      formal_status_count;
  END IF;
END
$migration$;

COMMIT;
