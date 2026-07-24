CREATE SCHEMA IF NOT EXISTS accounting;

CREATE TABLE IF NOT EXISTS accounting.receipt_imports (
  id BIGSERIAL PRIMARY KEY,

  upload_id TEXT,
  wix_item_id TEXT,
  wix_image_url TEXT,

  local_image_file_name TEXT,
  local_image_path TEXT,
  image_hash_sha256 TEXT,
  image_size_bytes BIGINT,

  original_file_name TEXT,

  captured_at_jst TIMESTAMP,
  imported_at_jst TIMESTAMP,
  import_batch_id TEXT,

  ocr_provider TEXT,
  ocr_raw_text TEXT,
  ocr_line_count INTEGER,
  ocr_word_count INTEGER,

  status TEXT NOT NULL DEFAULT 'imported',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_receipt_imports_upload_id
ON accounting.receipt_imports (upload_id)
WHERE upload_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_receipt_imports_wix_item_id
ON accounting.receipt_imports (wix_item_id)
WHERE wix_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_receipt_imports_hash
ON accounting.receipt_imports (image_hash_sha256)
WHERE image_hash_sha256 IS NOT NULL;
