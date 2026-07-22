BEGIN;

ALTER TABLE accounting.receipt_draft_details
    ADD COLUMN IF NOT EXISTS receipt_summary_id BIGINT;

ALTER TABLE accounting.receipt_details
    ADD COLUMN IF NOT EXISTS receipt_summary_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'fk_receipt_draft_details_receipt_summary'
          AND conrelid =
            'accounting.receipt_draft_details'::regclass
    ) THEN
        ALTER TABLE accounting.receipt_draft_details
            ADD CONSTRAINT
                fk_receipt_draft_details_receipt_summary
            FOREIGN KEY (receipt_summary_id)
            REFERENCES expenses.receipt_summaries (
                receipt_summary_id
            )
            ON UPDATE CASCADE
            ON DELETE SET NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'fk_receipt_details_receipt_summary'
          AND conrelid =
            'accounting.receipt_details'::regclass
    ) THEN
        ALTER TABLE accounting.receipt_details
            ADD CONSTRAINT
                fk_receipt_details_receipt_summary
            FOREIGN KEY (receipt_summary_id)
            REFERENCES expenses.receipt_summaries (
                receipt_summary_id
            )
            ON UPDATE CASCADE
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS
    ix_receipt_draft_details_receipt_summary_id
ON accounting.receipt_draft_details (
    receipt_summary_id
);

CREATE INDEX IF NOT EXISTS
    ix_receipt_details_receipt_summary_id
ON accounting.receipt_details (
    receipt_summary_id
);

COMMENT ON COLUMN
    accounting.receipt_draft_details.receipt_summary_id
IS
    '摘要分類マスタID。自由文のsummaryとは別管理。';

COMMENT ON COLUMN
    accounting.receipt_details.receipt_summary_id
IS
    '摘要分類マスタID。自由文のsummaryとは別管理。';

COMMIT;