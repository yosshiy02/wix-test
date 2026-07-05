BEGIN;

CREATE SCHEMA IF NOT EXISTS system;

CREATE TABLE IF NOT EXISTS system.schema_migrations (
  version text PRIMARY KEY,
  name text NOT NULL,
  file_name text NOT NULL,
  checksum_sha256 text,
  applied_at timestamp with time zone NOT NULL DEFAULT now(),
  applied_by text NOT NULL DEFAULT current_user,
  memo text
);

DO $$
BEGIN
  IF to_regclass('accounting.receipt_drafts') IS NULL THEN
    RAISE EXCEPTION 'missing table: accounting.receipt_drafts';
  END IF;

  IF to_regclass('accounting.receipt_draft_details') IS NULL THEN
    RAISE EXCEPTION 'missing table: accounting.receipt_draft_details';
  END IF;

  IF to_regclass('accounting.receipt_draft_detail_breakdowns') IS NULL THEN
    RAISE EXCEPTION 'missing table: accounting.receipt_draft_detail_breakdowns';
  END IF;

  IF to_regclass('accounting.receipts') IS NULL THEN
    RAISE EXCEPTION 'missing table: accounting.receipts';
  END IF;

  IF to_regclass('accounting.receipt_details') IS NULL THEN
    RAISE EXCEPTION 'missing table: accounting.receipt_details';
  END IF;

  IF to_regclass('accounting.receipt_detail_breakdowns') IS NULL THEN
    RAISE EXCEPTION 'missing table: accounting.receipt_detail_breakdowns';
  END IF;
END
$$;

INSERT INTO system.schema_migrations
  (version, name, file_name, checksum_sha256, memo)
VALUES
  ('20260705_001_receipt_6tables', 'receipt_6tables', '20260705_001_receipt_6tables.sql', '2acac54fa34936cf5b6c40f1d56a30cbec5a28e7f91160d4517ded9236218c56', 'receipt_6tables history fixed after existing 6 tables check')
ON CONFLICT (version) DO UPDATE SET
  name = EXCLUDED.name,
  file_name = EXCLUDED.file_name,
  checksum_sha256 = EXCLUDED.checksum_sha256,
  memo = EXCLUDED.memo;

COMMIT;

SELECT
  version,
  name,
  file_name,
  checksum_sha256,
  applied_at,
  checksum_sha256 = '2acac54fa34936cf5b6c40f1d56a30cbec5a28e7f91160d4517ded9236218c56' AS checksum_matches
FROM system.schema_migrations
WHERE version = '20260705_001_receipt_6tables';