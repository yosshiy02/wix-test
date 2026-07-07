CREATE SCHEMA IF NOT EXISTS accounting;

CREATE TABLE IF NOT EXISTS accounting.delivery_note_imports (
  id BIGSERIAL PRIMARY KEY,
  local_image_file_name TEXT NOT NULL,
  local_image_path TEXT NOT NULL,
  original_file_name TEXT,
  image_hash_sha256 TEXT,
  image_size_bytes BIGINT,
  mime_type TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual_upload',
  import_status TEXT NOT NULL DEFAULT '取込済み',
  ocr_status TEXT NOT NULL DEFAULT '未OCR',
  ocr_provider TEXT,
  ocr_raw_text TEXT,
  ai_status TEXT NOT NULL DEFAULT '未解析',
  ai_json JSONB,
  captured_at_jst TIMESTAMPTZ,
  imported_at_jst TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_note_imports_imported_at
  ON accounting.delivery_note_imports (imported_at_jst DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_note_imports_hash
  ON accounting.delivery_note_imports (image_hash_sha256);

CREATE TABLE IF NOT EXISTS accounting.delivery_note_drafts (
  delivery_note_draft_id BIGSERIAL PRIMARY KEY,
  import_id BIGINT REFERENCES accounting.delivery_note_imports(id) ON DELETE SET NULL,
  draft_status TEXT NOT NULL DEFAULT '下書き',
  delivery_date DATE,
  vendor_name TEXT,
  delivery_note_no TEXT,
  total_quantity NUMERIC(14, 2),
  subtotal_amount NUMERIC(14, 2),
  tax_amount NUMERIC(14, 2),
  total_amount NUMERIC(14, 2),
  summary TEXT,
  memo TEXT,
  ocr_raw_text TEXT,
  ai_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_note_drafts_import_id
  ON accounting.delivery_note_drafts (import_id);

CREATE INDEX IF NOT EXISTS idx_delivery_note_drafts_delivery_date
  ON accounting.delivery_note_drafts (delivery_date DESC, delivery_note_draft_id DESC);

CREATE TABLE IF NOT EXISTS accounting.delivery_note_draft_details (
  delivery_note_draft_detail_id BIGSERIAL PRIMARY KEY,
  delivery_note_draft_id BIGINT NOT NULL REFERENCES accounting.delivery_note_drafts(delivery_note_draft_id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 1,
  item_code TEXT,
  item_name TEXT,
  description TEXT,
  quantity NUMERIC(14, 2),
  unit TEXT,
  unit_price NUMERIC(14, 2),
  amount NUMERIC(14, 2),
  tax_category_id INTEGER,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_note_draft_details_draft_id
  ON accounting.delivery_note_draft_details (delivery_note_draft_id, line_no);

CREATE TABLE IF NOT EXISTS accounting.delivery_notes (
  delivery_note_id BIGSERIAL PRIMARY KEY,
  import_id BIGINT REFERENCES accounting.delivery_note_imports(id) ON DELETE SET NULL,
  delivery_note_draft_id BIGINT REFERENCES accounting.delivery_note_drafts(delivery_note_draft_id) ON DELETE SET NULL,
  save_status TEXT NOT NULL DEFAULT '本保存済み',
  delivery_date DATE,
  vendor_name TEXT,
  delivery_note_no TEXT,
  total_quantity NUMERIC(14, 2),
  subtotal_amount NUMERIC(14, 2),
  tax_amount NUMERIC(14, 2),
  total_amount NUMERIC(14, 2),
  summary TEXT,
  memo TEXT,
  ocr_raw_text TEXT,
  ai_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_delivery_date
  ON accounting.delivery_notes (delivery_date DESC, delivery_note_id DESC);

CREATE TABLE IF NOT EXISTS accounting.delivery_note_details (
  delivery_note_detail_id BIGSERIAL PRIMARY KEY,
  delivery_note_id BIGINT NOT NULL REFERENCES accounting.delivery_notes(delivery_note_id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 1,
  item_code TEXT,
  item_name TEXT,
  description TEXT,
  quantity NUMERIC(14, 2),
  unit TEXT,
  unit_price NUMERIC(14, 2),
  amount NUMERIC(14, 2),
  tax_category_id INTEGER,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_note_details_delivery_note_id
  ON accounting.delivery_note_details (delivery_note_id, line_no);