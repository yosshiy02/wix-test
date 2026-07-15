-- カレンダー用イベントテーブル
CREATE TABLE IF NOT EXISTS calendar_events_multi (
    event_id VARCHAR(100) PRIMARY KEY,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ユーザー＆設定用テーブル（KeyValueストア方式）
CREATE TABLE IF NOT EXISTS calendar_kv_store (
    store_key VARCHAR(100) PRIMARY KEY,
    store_value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
