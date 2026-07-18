-- DRAFT ONLY / DO NOT EXECUTE
-- HD Origin Project CSV Integration History Draft
-- このSQLは案のみです。本番適用しないこと。
-- 既存migrationへ追加しないこと。
-- PostgreSQLへ実行しないこと。

-- 想定スキーマ
-- CREATE SCHEMA IF NOT EXISTS integration;

-- =========================================================
-- integration.csv_export_histories
-- =========================================================
-- 想定用途:
-- CSV出力履歴の保存
-- 出力条件、件数、警告、エラー、ファイル識別子を保持

CREATE TABLE IF NOT EXISTS integration.csv_export_histories (
    csv_export_history_id BIGSERIAL PRIMARY KEY,
    profile_code VARCHAR(100) NOT NULL,
    export_type VARCHAR(100) NULL,
    company_id BIGINT NULL,
    file_name VARCHAR(255) NOT NULL,
    encoding VARCHAR(50) NOT NULL,
    delimiter VARCHAR(10) NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0,
    source_record_ids_json JSONB NULL,
    filter_json JSONB NULL,
    warning_json JSONB NULL,
    error_json JSONB NULL,
    exported_by VARCHAR(100) NULL,
    exported_at TIMESTAMP NULL,
    file_sha256 VARCHAR(128) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 推奨インデックス案
CREATE INDEX IF NOT EXISTS idx_csv_export_histories_profile_code
    ON integration.csv_export_histories(profile_code);

CREATE INDEX IF NOT EXISTS idx_csv_export_histories_company_id
    ON integration.csv_export_histories(company_id);

CREATE INDEX IF NOT EXISTS idx_csv_export_histories_exported_at
    ON integration.csv_export_histories(exported_at);

CREATE INDEX IF NOT EXISTS idx_csv_export_histories_status
    ON integration.csv_export_histories(status);

CREATE INDEX IF NOT EXISTS idx_csv_export_histories_file_sha256
    ON integration.csv_export_histories(file_sha256);

-- =========================================================
-- integration.csv_import_histories
-- =========================================================
-- 想定用途:
-- CSV取込履歴の保存
-- 元ファイル、成功件数、警告件数、エラー件数、結果JSONを保持

CREATE TABLE IF NOT EXISTS integration.csv_import_histories (
    csv_import_history_id BIGSERIAL PRIMARY KEY,
    profile_code VARCHAR(100) NOT NULL,
    import_type VARCHAR(100) NULL,
    original_file_name VARCHAR(255) NOT NULL,
    encoding VARCHAR(50) NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    result_json JSONB NULL,
    file_sha256 VARCHAR(128) NULL,
    imported_by VARCHAR(100) NULL,
    imported_at TIMESTAMP NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 推奨インデックス案
CREATE INDEX IF NOT EXISTS idx_csv_import_histories_profile_code
    ON integration.csv_import_histories(profile_code);

CREATE INDEX IF NOT EXISTS idx_csv_import_histories_imported_at
    ON integration.csv_import_histories(imported_at);

CREATE INDEX IF NOT EXISTS idx_csv_import_histories_status
    ON integration.csv_import_histories(status);

CREATE INDEX IF NOT EXISTS idx_csv_import_histories_file_sha256
    ON integration.csv_import_histories(file_sha256);

-- =========================================================
-- 補足
-- =========================================================
-- updated_at 自動更新トリガーは将来検討
-- company_id は既存会社マスタ接続時に実体確定
-- exported_by / imported_by は将来ユーザー管理接続時に実体確定
-- source_record_ids_json / filter_json / result_json の構造は将来API仕様に合わせて確定