BEGIN;

CREATE TABLE IF NOT EXISTS expenses.receipt_summaries (
    receipt_summary_id BIGSERIAL PRIMARY KEY,
    receipt_summary_code VARCHAR(80) NOT NULL,
    receipt_summary_name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    account_title_hint VARCHAR(120),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_receipt_summaries_code
ON expenses.receipt_summaries (
    receipt_summary_code
);

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_receipt_summaries_name
ON expenses.receipt_summaries (
    receipt_summary_name
);

CREATE INDEX IF NOT EXISTS
    ix_receipt_summaries_active_sort
ON expenses.receipt_summaries (
    is_active,
    sort_order,
    receipt_summary_id
);

COMMENT ON TABLE expenses.receipt_summaries IS
'レシート・領収書の摘要候補を統一するためのマスタ。目的マスタとは別管理。';

COMMENT ON COLUMN expenses.receipt_summaries.receipt_summary_code IS
'システム内部で使用する変更しない摘要コード';

COMMENT ON COLUMN expenses.receipt_summaries.receipt_summary_name IS
'画面表示およびAI選択に使用する標準摘要';

COMMENT ON COLUMN expenses.receipt_summaries.description IS
'AIが摘要を選択するための使用条件と意味';

COMMENT ON COLUMN expenses.receipt_summaries.account_title_hint IS
'AI判断を補助する関連勘定科目名。固定判定には使用しない。';

COMMIT;