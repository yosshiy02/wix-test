BEGIN;

ALTER TABLE accounting.payable_documents
  ADD COLUMN IF NOT EXISTS company_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS evidence_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS evidence_due_date DATE NULL,
  ADD COLUMN IF NOT EXISTS evidence_received_date DATE NULL,
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS review_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS warning_level TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS professional_review_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS professional_review_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS professional_reviewer TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS professional_reviewed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS professional_review_result TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payable_documents_evidence_status_chk'
  ) THEN
    ALTER TABLE accounting.payable_documents
      ADD CONSTRAINT payable_documents_evidence_status_chk
      CHECK (
        evidence_status IN (
          'not_required',
          'received',
          'missing',
          'pending',
          'mismatch'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payable_documents_review_status_chk'
  ) THEN
    ALTER TABLE accounting.payable_documents
      ADD CONSTRAINT payable_documents_review_status_chk
      CHECK (
        review_status IN (
          'unreviewed',
          'needs_review',
          'confirmed',
          'rejected'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payable_documents_warning_level_chk'
  ) THEN
    ALTER TABLE accounting.payable_documents
      ADD CONSTRAINT payable_documents_warning_level_chk
      CHECK (
        warning_level IN (
          'none',
          'info',
          'warning',
          'critical'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payable_documents_professional_review_status_chk'
  ) THEN
    ALTER TABLE accounting.payable_documents
      ADD CONSTRAINT payable_documents_professional_review_status_chk
      CHECK (
        professional_review_status IN (
          'not_required',
          'pending',
          'requested',
          'confirmed',
          'recheck_required'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS payable_documents_company_code_idx
  ON accounting.payable_documents(company_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS payable_documents_evidence_status_idx
  ON accounting.payable_documents(evidence_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS payable_documents_evidence_due_date_idx
  ON accounting.payable_documents(evidence_due_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS payable_documents_review_status_idx
  ON accounting.payable_documents(review_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS payable_documents_professional_review_status_idx
  ON accounting.payable_documents(professional_review_status)
  WHERE deleted_at IS NULL;

COMMIT;