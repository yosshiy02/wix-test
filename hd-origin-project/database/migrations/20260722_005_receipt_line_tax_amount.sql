ALTER TABLE accounting.receipt_draft_detail_breakdowns
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2);

ALTER TABLE accounting.receipt_detail_breakdowns
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2);

COMMENT ON COLUMN accounting.receipt_draft_detail_breakdowns.tax_amount
    IS '明細ごとの消費税額。Node.jsで税率別確定税額に一致するよう配分する。';

COMMENT ON COLUMN accounting.receipt_detail_breakdowns.tax_amount
    IS '明細ごとの消費税額。下書き明細から本保存時に引き継ぐ。';