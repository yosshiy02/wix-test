-- HD Origin Project
-- Migration: 20260703_001_baseline_current_schema
--
-- 目的:
-- 現在のDB構造を、今後の基準点 baseline として記録する。
--
-- 注意:
-- この migration は既存の業務テーブルを変更しない。
-- system.schema_migrations 管理テーブルだけを作成する。

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
