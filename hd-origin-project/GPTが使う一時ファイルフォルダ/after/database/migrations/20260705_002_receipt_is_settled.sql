-- ============================================================
-- Migration: 20260705_002_receipt_is_settled
-- Purpose  : レシート下書き明細・本保存明細に精算済みフラグを追加
-- Note     : レシート本保存 = 証憑保存。精算済みとは別。
--            対象者 target_person_id と同じ明細側に is_settled を持たせる。
-- ============================================================

ALTER TABLE accounting.receipt_draft_details
  ADD COLUMN IF NOT EXISTS is_settled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE accounting.receipt_details
  ADD COLUMN IF NOT EXISTS is_settled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN accounting.receipt_draft_details.is_settled
  IS '対象者への精算済みフラグ。FALSE=未精算、TRUE=清算済み。';

COMMENT ON COLUMN accounting.receipt_details.is_settled
  IS '対象者への精算済みフラグ。FALSE=未精算、TRUE=清算済み。';
