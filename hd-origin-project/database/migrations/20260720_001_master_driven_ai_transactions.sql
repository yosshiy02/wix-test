BEGIN;

CREATE SCHEMA IF NOT EXISTS accounting;

CREATE OR REPLACE FUNCTION accounting.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


/* =============================================================================
   1. 既存OCR取込テーブルの拡張
   前提PK:
     accounting.payment_document_ocr_imports.payment_document_ocr_import_id
   ============================================================================= */

ALTER TABLE accounting.payment_document_ocr_imports
    ADD COLUMN IF NOT EXISTS import_source_id BIGINT,
    ADD COLUMN IF NOT EXISTS file_format_id BIGINT,
    ADD COLUMN IF NOT EXISTS original_file_name TEXT,
    ADD COLUMN IF NOT EXISTS stored_file_reference TEXT,
    ADD COLUMN IF NOT EXISTS file_sha256 VARCHAR(64),
    ADD COLUMN IF NOT EXISTS ocr_raw_text TEXT,
    ADD COLUMN IF NOT EXISTS ocr_result_json JSONB,
    ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC(7,6),
    ADD COLUMN IF NOT EXISTS ocr_status_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS ocr_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS has_error BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS error_message TEXT,
    ADD COLUMN IF NOT EXISTS latest_basic_analysis_id BIGINT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE accounting.payment_document_ocr_imports
    DROP CONSTRAINT IF EXISTS ck_payment_document_ocr_imports_ocr_confidence;

ALTER TABLE accounting.payment_document_ocr_imports
    ADD CONSTRAINT ck_payment_document_ocr_imports_ocr_confidence
    CHECK (
        ocr_confidence IS NULL
        OR ocr_confidence BETWEEN 0 AND 1
    );

ALTER TABLE accounting.payment_document_ocr_imports
    DROP CONSTRAINT IF EXISTS ck_payment_document_ocr_imports_file_sha256;

ALTER TABLE accounting.payment_document_ocr_imports
    ADD CONSTRAINT ck_payment_document_ocr_imports_file_sha256
    CHECK (
        file_sha256 IS NULL
        OR file_sha256 ~ '^[0-9A-Fa-f]{64}$'
    );


/* =============================================================================
   2. AI一次判定履歴
   ============================================================================= */

CREATE TABLE accounting.payment_document_basic_analysis_results (
    basic_analysis_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    payment_document_ocr_import_id BIGINT NOT NULL,

    company_id BIGINT,
    document_type_id BIGINT,
    specialist_analysis_id BIGINT,

    ai_confidence NUMERIC(7,6),
    ai_reason TEXT,
    needs_review BOOLEAN NOT NULL DEFAULT FALSE,

    warnings_json JSONB NOT NULL DEFAULT '[]'::JSONB,
    raw_result_json JSONB NOT NULL DEFAULT '{}'::JSONB,

    candidate_masters_snapshot_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    output_schema_snapshot_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    prompt_snapshot TEXT,

    model_name VARCHAR(255),
    prompt_version VARCHAR(100),

    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    analysis_completed BOOLEAN NOT NULL DEFAULT FALSE,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_basic_analysis_ocr_import
        FOREIGN KEY (payment_document_ocr_import_id)
        REFERENCES accounting.payment_document_ocr_imports (
            payment_document_ocr_import_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_basic_analysis_company
        FOREIGN KEY (company_id)
        REFERENCES accounting.companies (company_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_basic_analysis_document_type
        FOREIGN KEY (document_type_id)
        REFERENCES accounting.payment_document_types (document_type_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_basic_analysis_specialist
        FOREIGN KEY (specialist_analysis_id)
        REFERENCES accounting.payment_document_specialist_analyses (
            specialist_analysis_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT ck_basic_analysis_confidence
        CHECK (
            ai_confidence IS NULL
            OR ai_confidence BETWEEN 0 AND 1
        ),

    CONSTRAINT ck_basic_analysis_warnings_array
        CHECK (jsonb_typeof(warnings_json) = 'array'),

    CONSTRAINT ck_basic_analysis_raw_result_object
        CHECK (jsonb_typeof(raw_result_json) = 'object'),

    CONSTRAINT ck_basic_analysis_candidate_snapshot_object
        CHECK (
            jsonb_typeof(candidate_masters_snapshot_json) = 'object'
        ),

    CONSTRAINT ck_basic_analysis_schema_snapshot_object
        CHECK (
            jsonb_typeof(output_schema_snapshot_json) = 'object'
        ),

    CONSTRAINT ck_basic_analysis_completed_time
        CHECK (
            completed_at IS NULL
            OR started_at IS NULL
            OR completed_at >= started_at
        )
);


/* =============================================================================
   3. 専門解析実行履歴
   ============================================================================= */

CREATE TABLE accounting.payment_document_specialist_analysis_runs (
    specialist_analysis_run_id
        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    payment_document_ocr_import_id BIGINT NOT NULL,
    basic_analysis_id BIGINT NOT NULL,
    specialist_analysis_id BIGINT NOT NULL,

    run_status VARCHAR(50) NOT NULL DEFAULT 'pending',

    requested_items_snapshot_json JSONB NOT NULL DEFAULT '[]'::JSONB,
    output_schema_snapshot_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    prompt_snapshot TEXT NOT NULL,

    raw_result_json JSONB,
    warnings_json JSONB NOT NULL DEFAULT '[]'::JSONB,

    model_name VARCHAR(255),
    prompt_version VARCHAR(100),

    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error_message TEXT,

    is_current BOOLEAN NOT NULL DEFAULT TRUE,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_specialist_runs_ocr_import
        FOREIGN KEY (payment_document_ocr_import_id)
        REFERENCES accounting.payment_document_ocr_imports (
            payment_document_ocr_import_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_specialist_runs_basic_analysis
        FOREIGN KEY (basic_analysis_id)
        REFERENCES accounting.payment_document_basic_analysis_results (
            basic_analysis_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_specialist_runs_specialist
        FOREIGN KEY (specialist_analysis_id)
        REFERENCES accounting.payment_document_specialist_analyses (
            specialist_analysis_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT ck_specialist_runs_status
        CHECK (
            run_status IN (
                'pending',
                'running',
                'completed',
                'failed',
                'cancelled'
            )
        ),

    CONSTRAINT ck_specialist_runs_requested_items_array
        CHECK (
            jsonb_typeof(requested_items_snapshot_json) = 'array'
        ),

    CONSTRAINT ck_specialist_runs_schema_object
        CHECK (
            jsonb_typeof(output_schema_snapshot_json) = 'object'
        ),

    CONSTRAINT ck_specialist_runs_raw_result
        CHECK (
            raw_result_json IS NULL
            OR jsonb_typeof(raw_result_json) = 'object'
        ),

    CONSTRAINT ck_specialist_runs_warnings_array
        CHECK (jsonb_typeof(warnings_json) = 'array'),

    CONSTRAINT ck_specialist_runs_retry_count
        CHECK (retry_count >= 0),

    CONSTRAINT ck_specialist_runs_completed_time
        CHECK (
            completed_at IS NULL
            OR started_at IS NULL
            OR completed_at >= started_at
        )
);


/* =============================================================================
   4. 専門解析の項目別結果値
   ============================================================================= */

CREATE TABLE accounting.payment_document_analysis_values (
    analysis_value_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    specialist_analysis_run_id BIGINT NOT NULL,
    payment_document_ocr_import_id BIGINT NOT NULL,
    specialist_analysis_id BIGINT NOT NULL,
    analysis_item_id BIGINT NOT NULL,

    text_value TEXT,
    numeric_value NUMERIC,
    date_value DATE,
    timestamp_value TIMESTAMPTZ,
    boolean_value BOOLEAN,
    json_value JSONB,

    display_value TEXT,

    ai_confidence NUMERIC(7,6),
    ai_extraction_reason TEXT,

    needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    is_human_corrected BOOLEAN NOT NULL DEFAULT FALSE,

    original_ai_value_json JSONB,
    human_corrected_value_json JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_analysis_values_run
        FOREIGN KEY (specialist_analysis_run_id)
        REFERENCES accounting.payment_document_specialist_analysis_runs (
            specialist_analysis_run_id
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    CONSTRAINT fk_analysis_values_ocr_import
        FOREIGN KEY (payment_document_ocr_import_id)
        REFERENCES accounting.payment_document_ocr_imports (
            payment_document_ocr_import_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_analysis_values_specialist
        FOREIGN KEY (specialist_analysis_id)
        REFERENCES accounting.payment_document_specialist_analyses (
            specialist_analysis_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_analysis_values_item
        FOREIGN KEY (analysis_item_id)
        REFERENCES accounting.analysis_items (analysis_item_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT uq_analysis_values_run_item
        UNIQUE (
            specialist_analysis_run_id,
            analysis_item_id
        ),

    CONSTRAINT ck_analysis_values_confidence
        CHECK (
            ai_confidence IS NULL
            OR ai_confidence BETWEEN 0 AND 1
        ),

    CONSTRAINT ck_analysis_values_single_typed_value
        CHECK (
            (
                CASE WHEN text_value IS NOT NULL THEN 1 ELSE 0 END
                +
                CASE WHEN numeric_value IS NOT NULL THEN 1 ELSE 0 END
                +
                CASE WHEN date_value IS NOT NULL THEN 1 ELSE 0 END
                +
                CASE WHEN timestamp_value IS NOT NULL THEN 1 ELSE 0 END
                +
                CASE WHEN boolean_value IS NOT NULL THEN 1 ELSE 0 END
                +
                CASE WHEN json_value IS NOT NULL THEN 1 ELSE 0 END
            ) <= 1
        )
);


/* =============================================================================
   5. OCR取込から最新一次判定への外部キー
   ============================================================================= */

ALTER TABLE accounting.payment_document_ocr_imports
    ADD CONSTRAINT fk_ocr_imports_latest_basic_analysis
    FOREIGN KEY (latest_basic_analysis_id)
    REFERENCES accounting.payment_document_basic_analysis_results (
        basic_analysis_id
    )
    ON UPDATE RESTRICT
    ON DELETE SET NULL;


/* =============================================================================
   6. インデックス
   ============================================================================= */

CREATE INDEX idx_payment_document_ocr_imports_ocr_status
    ON accounting.payment_document_ocr_imports (
        ocr_status_code
    );

CREATE INDEX idx_payment_document_ocr_imports_created_at
    ON accounting.payment_document_ocr_imports (
        created_at DESC
    );

CREATE UNIQUE INDEX uq_payment_document_ocr_imports_file_sha256
    ON accounting.payment_document_ocr_imports (file_sha256)
    WHERE file_sha256 IS NOT NULL;


CREATE INDEX idx_basic_analysis_ocr_import
    ON accounting.payment_document_basic_analysis_results (
        payment_document_ocr_import_id,
        created_at DESC
    );

CREATE INDEX idx_basic_analysis_company
    ON accounting.payment_document_basic_analysis_results (company_id);

CREATE INDEX idx_basic_analysis_document_type
    ON accounting.payment_document_basic_analysis_results (document_type_id);

CREATE INDEX idx_basic_analysis_specialist
    ON accounting.payment_document_basic_analysis_results (
        specialist_analysis_id
    );

CREATE INDEX idx_basic_analysis_needs_review
    ON accounting.payment_document_basic_analysis_results (
        needs_review,
        created_at DESC
    );

CREATE UNIQUE INDEX uq_basic_analysis_current_per_ocr
    ON accounting.payment_document_basic_analysis_results (
        payment_document_ocr_import_id
    )
    WHERE is_current = TRUE;


CREATE INDEX idx_specialist_runs_ocr_import
    ON accounting.payment_document_specialist_analysis_runs (
        payment_document_ocr_import_id,
        created_at DESC
    );

CREATE INDEX idx_specialist_runs_basic_analysis
    ON accounting.payment_document_specialist_analysis_runs (
        basic_analysis_id
    );

CREATE INDEX idx_specialist_runs_specialist
    ON accounting.payment_document_specialist_analysis_runs (
        specialist_analysis_id,
        created_at DESC
    );

CREATE INDEX idx_specialist_runs_status
    ON accounting.payment_document_specialist_analysis_runs (
        run_status,
        created_at DESC
    );

CREATE UNIQUE INDEX uq_specialist_runs_current
    ON accounting.payment_document_specialist_analysis_runs (
        payment_document_ocr_import_id,
        specialist_analysis_id
    )
    WHERE is_current = TRUE;


CREATE INDEX idx_analysis_values_run
    ON accounting.payment_document_analysis_values (
        specialist_analysis_run_id
    );

CREATE INDEX idx_analysis_values_ocr_import
    ON accounting.payment_document_analysis_values (
        payment_document_ocr_import_id
    );

CREATE INDEX idx_analysis_values_specialist
    ON accounting.payment_document_analysis_values (
        specialist_analysis_id
    );

CREATE INDEX idx_analysis_values_item
    ON accounting.payment_document_analysis_values (
        analysis_item_id
    );

CREATE INDEX idx_analysis_values_review
    ON accounting.payment_document_analysis_values (
        needs_review,
        created_at DESC
    );

CREATE INDEX idx_analysis_values_date
    ON accounting.payment_document_analysis_values (
        analysis_item_id,
        date_value
    )
    WHERE date_value IS NOT NULL;

CREATE INDEX idx_analysis_values_numeric
    ON accounting.payment_document_analysis_values (
        analysis_item_id,
        numeric_value
    )
    WHERE numeric_value IS NOT NULL;

CREATE INDEX idx_analysis_values_json_gin
    ON accounting.payment_document_analysis_values
    USING GIN (json_value)
    WHERE json_value IS NOT NULL;


/* =============================================================================
   7. updated_atトリガー
   ============================================================================= */

DROP TRIGGER IF EXISTS
    trg_payment_document_ocr_imports_set_updated_at
ON accounting.payment_document_ocr_imports;

CREATE TRIGGER trg_payment_document_ocr_imports_set_updated_at
BEFORE UPDATE ON accounting.payment_document_ocr_imports
FOR EACH ROW
EXECUTE FUNCTION accounting.set_updated_at();


CREATE TRIGGER trg_basic_analysis_results_set_updated_at
BEFORE UPDATE ON accounting.payment_document_basic_analysis_results
FOR EACH ROW
EXECUTE FUNCTION accounting.set_updated_at();


CREATE TRIGGER trg_specialist_analysis_runs_set_updated_at
BEFORE UPDATE ON accounting.payment_document_specialist_analysis_runs
FOR EACH ROW
EXECUTE FUNCTION accounting.set_updated_at();


CREATE TRIGGER trg_analysis_values_set_updated_at
BEFORE UPDATE ON accounting.payment_document_analysis_values
FOR EACH ROW
EXECUTE FUNCTION accounting.set_updated_at();


COMMENT ON TABLE accounting.payment_document_basic_analysis_results
    IS 'AI一次判定の履歴。会社、文書種別、専門解析先のAI判定結果を保存する';

COMMENT ON TABLE accounting.payment_document_specialist_analysis_runs
    IS 'DBマスタから生成した要求項目、JSONスキーマ、プロンプトとAI返却を保存する';

COMMENT ON TABLE accounting.payment_document_analysis_values
    IS '専門解析結果をanalysis_item_id単位の型付き値として保存する';

COMMIT;
