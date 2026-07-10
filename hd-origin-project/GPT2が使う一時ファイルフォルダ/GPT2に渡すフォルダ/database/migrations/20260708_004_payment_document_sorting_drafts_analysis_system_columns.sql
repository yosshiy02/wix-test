-- ============================================================
-- HD Origin Project
-- 支払書類仕分け analysis_system_* 列追加
-- 作成日: 2026-07-08
--
-- 目的:
-- 1回目AI仕分けの結果に、会計・処理先分類とは別軸で
-- 「どの専門解析システムへ送るか」を保持する。
--
-- 注意:
-- このSQLはマイグレーションファイルです。
-- このファイル作成だけではDBへ反映されません。
-- ============================================================

ALTER TABLE IF EXISTS accounting.payment_document_sorting_drafts
  ADD COLUMN IF NOT EXISTS analysis_system_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS analysis_system_label VARCHAR(160),
  ADD COLUMN IF NOT EXISTS analysis_system_reason TEXT,
  ADD COLUMN IF NOT EXISTS analysis_system_confidence VARCHAR(20);

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.analysis_system_code
  IS '1回目AI仕分けで判定した専門解析システムコード。会計確定ではなく次段解析ルート。';

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.analysis_system_label
  IS '1回目AI仕分けで判定した専門解析システム表示名。';

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.analysis_system_reason
  IS '専門解析システムへ送る判定理由。';

COMMENT ON COLUMN accounting.payment_document_sorting_drafts.analysis_system_confidence
  IS '専門解析システム判定の信頼度。高・中・低など。';