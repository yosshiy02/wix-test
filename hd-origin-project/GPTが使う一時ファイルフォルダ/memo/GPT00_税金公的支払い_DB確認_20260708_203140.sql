\pset pager off
\pset null '[NULL]'

\echo ==============================
\echo GPT00 税金・公的支払い側 DB確認
\echo ==============================

\echo
\echo [DB接続確認]
select
  current_database() as current_database,
  current_user as current_user,
  version() as postgres_version;

\echo
\echo [payment_document / payable 系テーブル一覧]
select
  table_schema,
  table_name
from information_schema.tables
where table_type = 'BASE TABLE'
  and table_schema not in ('pg_catalog', 'information_schema')
  and (
    table_name like '%payment_document%'
    or table_name like '%payable%'
    or table_name like '%payment%'
    or table_name like '%tax%'
    or table_name like '%master%'
  )
order by table_schema, table_name;

\echo
\echo [主要テーブルの列一覧]
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema')
  and table_name in (
    'payment_document_sorting_drafts',
    'payment_document_ocr_imports',
    'payables',
    'payable_details',
    'masters',
    'master_items'
  )
order by table_schema, table_name, ordinal_position;

\echo
\echo [税金・公的支払いに関係しそうな列]
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema')
  and (
    column_name like '%tax%'
    or column_name like '%public%'
    or column_name like '%notice%'
    or column_name like '%payment%'
    or column_name like '%payable%'
    or column_name like '%document%'
    or column_name like '%analysis%'
    or column_name like '%specialist%'
    or column_name like '%route%'
    or column_name like '%field%'
    or column_name like '%draft%'
    or column_name like '%json%'
    or column_name like '%amount%'
    or column_name like '%due%'
    or column_name like '%vendor%'
    or column_name like '%issuer%'
    or column_name like '%ocr%'
  )
order by table_schema, table_name, ordinal_position;

\echo
\echo [analysis_system 系列の有無]
select
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema')
  and column_name in (
    'analysis_system_code',
    'analysis_system_label',
    'analysis_system_reason',
    'analysis_system_confidence'
  )
order by table_schema, table_name, column_name;

\echo
\echo [JSON/JSONB列の有無]
select
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema')
  and data_type in ('json', 'jsonb')
order by table_schema, table_name, ordinal_position;

\echo
\echo [支払書類仕分け下書き 件数]
select
  table_schema,
  table_name,
  (
    xpath('/row/cnt/text()',
      query_to_xml(
        format('select count(*) as cnt from %I.%I', table_schema, table_name),
        false,
        true,
        ''
      )
    )
  )[1]::text as row_count
from information_schema.tables
where table_schema not in ('pg_catalog', 'information_schema')
  and table_name in (
    'payment_document_sorting_drafts',
    'payment_document_ocr_imports'
  )
order by table_schema, table_name;

\echo
\echo [実行済みマイグレーションらしきテーブル]
select
  table_schema,
  table_name
from information_schema.tables
where table_schema not in ('pg_catalog', 'information_schema')
  and (
    table_name like '%migration%'
    or table_name like '%schema%'
  )
order by table_schema, table_name;
