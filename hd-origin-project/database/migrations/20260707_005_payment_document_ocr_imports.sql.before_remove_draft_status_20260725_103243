CREATE SCHEMA IF NOT EXISTS accounting;

CREATE TABLE IF NOT EXISTS accounting.payment_document_ocr_imports (
  payment_document_ocr_import_id BIGSERIAL PRIMARY KEY,

  document_key TEXT NOT NULL UNIQUE,

  original_file_name TEXT NOT NULL DEFAULT '',
  saved_file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',

  document_type TEXT NOT NULL DEFAULT '',
  destination TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT '',
  vendor_name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',

  email_subject TEXT NOT NULL DEFAULT '',
  email_from TEXT NOT NULL DEFAULT '',
  email_received_at TEXT NOT NULL DEFAULT '',

  ocr_status TEXT NOT NULL DEFAULT '',
  ocr_provider TEXT NOT NULL DEFAULT '',
  ocr_api_version TEXT NOT NULL DEFAULT '',
  ocr_at TIMESTAMPTZ NULL,
  ocr_raw_text TEXT NOT NULL DEFAULT '',
  ocr_text_length INTEGER NOT NULL DEFAULT 0,
  ocr_error TEXT NOT NULL DEFAULT '',

  process_status TEXT NOT NULL DEFAULT '',
  save_status TEXT NOT NULL DEFAULT '',
  evidence_saved BOOLEAN NOT NULL DEFAULT false,
  ocr_saved BOOLEAN NOT NULL DEFAULT false,

  saved_relative_path TEXT NOT NULL DEFAULT '',
  saved_meta_relative_path TEXT NOT NULL DEFAULT '',
  saved_at TIMESTAMPTZ NULL,
  saved_by_page TEXT NOT NULL DEFAULT '',

  draft_status TEXT NOT NULL DEFAULT 'not_started',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS payment_document_ocr_imports_saved_at_idx
  ON accounting.payment_document_ocr_imports(saved_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS payment_document_ocr_imports_ocr_at_idx
  ON accounting.payment_document_ocr_imports(ocr_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS payment_document_ocr_imports_draft_status_idx
  ON accounting.payment_document_ocr_imports(draft_status)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION accounting.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_document_ocr_imports_updated_at
  ON accounting.payment_document_ocr_imports;

CREATE TRIGGER trg_payment_document_ocr_imports_updated_at
BEFORE UPDATE ON accounting.payment_document_ocr_imports
FOR EACH ROW
EXECUTE FUNCTION accounting.set_updated_at();