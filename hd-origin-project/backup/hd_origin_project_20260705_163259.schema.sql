--
-- PostgreSQL database dump
--

\restrict LXPJjk2alCs7ldh5xh8ZGI5FW2tcDk7xMOLGVFv4r7eDHWDXTh6igoEHjffEWD7

-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: accounting; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA accounting;


--
-- Name: expenses; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA expenses;


--
-- Name: system; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA system;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: receipt_ai_drafts; Type: TABLE; Schema: accounting; Owner: -
--

CREATE TABLE accounting.receipt_ai_drafts (
    id bigint NOT NULL,
    receipt_import_id bigint NOT NULL,
    transaction_date date,
    vendor_name text,
    total_amount integer,
    tax_amount integer,
    tax_rate text,
    payment_method_name text,
    account_title_name text,
    invoice_number text,
    summary text,
    memo text,
    confidence numeric(5,2),
    status text DEFAULT 'draft'::text NOT NULL,
    ai_model text,
    ai_raw_json jsonb,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    line_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    tax_treatment_name text,
    payment_method_id bigint,
    target_person_id bigint,
    purpose_id bigint,
    project_id bigint,
    department_id bigint,
    invoice_type_id bigint,
    evidence_type_id bigint,
    evidence_memo text,
    purpose_temp_name text,
    project_temp_name text,
    department_temp_name text,
    vendor_address text,
    vendor_phone text,
    receipt_time_text text
);


--
-- Name: receipt_ai_drafts_id_seq; Type: SEQUENCE; Schema: accounting; Owner: -
--

CREATE SEQUENCE accounting.receipt_ai_drafts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipt_ai_drafts_id_seq; Type: SEQUENCE OWNED BY; Schema: accounting; Owner: -
--

ALTER SEQUENCE accounting.receipt_ai_drafts_id_seq OWNED BY accounting.receipt_ai_drafts.id;


--
-- Name: receipt_detail_breakdowns; Type: TABLE; Schema: accounting; Owner: -
--

CREATE TABLE accounting.receipt_detail_breakdowns (
    receipt_detail_breakdown_id bigint NOT NULL,
    receipt_id bigint NOT NULL,
    receipt_detail_id bigint NOT NULL,
    source_draft_receipt_detail_breakdown_id bigint,
    item_name text,
    quantity numeric(14,4),
    unit_price numeric(14,2),
    amount numeric(14,2),
    tax_category_id bigint,
    tax_treatment_id bigint,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: receipt_detail_breakdowns_receipt_detail_breakdown_id_seq; Type: SEQUENCE; Schema: accounting; Owner: -
--

CREATE SEQUENCE accounting.receipt_detail_breakdowns_receipt_detail_breakdown_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipt_detail_breakdowns_receipt_detail_breakdown_id_seq; Type: SEQUENCE OWNED BY; Schema: accounting; Owner: -
--

ALTER SEQUENCE accounting.receipt_detail_breakdowns_receipt_detail_breakdown_id_seq OWNED BY accounting.receipt_detail_breakdowns.receipt_detail_breakdown_id;


--
-- Name: receipt_details; Type: TABLE; Schema: accounting; Owner: -
--

CREATE TABLE accounting.receipt_details (
    receipt_detail_id bigint NOT NULL,
    receipt_id bigint NOT NULL,
    source_draft_receipt_detail_id bigint,
    transaction_date date,
    receipt_time_text text,
    vendor_name text,
    vendor_address text,
    vendor_phone text,
    payment_method_id bigint,
    total_amount numeric(14,2),
    tax_total_amount numeric(14,2),
    invoice_number text,
    invoice_type_id bigint,
    evidence_type_id bigint,
    evidence_memo text,
    target_person_id bigint,
    summary text,
    memo text,
    account_title_id bigint,
    purpose_id bigint,
    project_id bigint,
    department_id bigint,
    ocr_raw_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ai_confidence numeric(10,4)
);


--
-- Name: receipt_details_receipt_detail_id_seq; Type: SEQUENCE; Schema: accounting; Owner: -
--

CREATE SEQUENCE accounting.receipt_details_receipt_detail_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipt_details_receipt_detail_id_seq; Type: SEQUENCE OWNED BY; Schema: accounting; Owner: -
--

ALTER SEQUENCE accounting.receipt_details_receipt_detail_id_seq OWNED BY accounting.receipt_details.receipt_detail_id;


--
-- Name: receipt_draft_detail_breakdowns; Type: TABLE; Schema: accounting; Owner: -
--

CREATE TABLE accounting.receipt_draft_detail_breakdowns (
    draft_receipt_detail_breakdown_id bigint NOT NULL,
    draft_receipt_id bigint NOT NULL,
    draft_receipt_detail_id bigint NOT NULL,
    item_name text,
    quantity numeric(14,4),
    unit_price numeric(14,2),
    amount numeric(14,2),
    tax_category_id bigint,
    tax_treatment_id bigint,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: receipt_draft_detail_breakdow_draft_receipt_detail_breakdow_seq; Type: SEQUENCE; Schema: accounting; Owner: -
--

CREATE SEQUENCE accounting.receipt_draft_detail_breakdow_draft_receipt_detail_breakdow_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipt_draft_detail_breakdow_draft_receipt_detail_breakdow_seq; Type: SEQUENCE OWNED BY; Schema: accounting; Owner: -
--

ALTER SEQUENCE accounting.receipt_draft_detail_breakdow_draft_receipt_detail_breakdow_seq OWNED BY accounting.receipt_draft_detail_breakdowns.draft_receipt_detail_breakdown_id;


--
-- Name: receipt_draft_details; Type: TABLE; Schema: accounting; Owner: -
--

CREATE TABLE accounting.receipt_draft_details (
    draft_receipt_detail_id bigint NOT NULL,
    draft_receipt_id bigint NOT NULL,
    receipt_import_id bigint,
    transaction_date date,
    receipt_time_text text,
    vendor_name text,
    vendor_address text,
    vendor_phone text,
    payment_method_id bigint,
    total_amount numeric(14,2),
    tax_total_amount numeric(14,2),
    invoice_number text,
    invoice_type_id bigint,
    evidence_type_id bigint,
    evidence_memo text,
    target_person_id bigint,
    summary text,
    memo text,
    account_title_id bigint,
    purpose_id bigint,
    project_id bigint,
    department_id bigint,
    ocr_raw_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ai_confidence numeric(10,4)
);


--
-- Name: receipt_draft_details_draft_receipt_detail_id_seq; Type: SEQUENCE; Schema: accounting; Owner: -
--

CREATE SEQUENCE accounting.receipt_draft_details_draft_receipt_detail_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipt_draft_details_draft_receipt_detail_id_seq; Type: SEQUENCE OWNED BY; Schema: accounting; Owner: -
--

ALTER SEQUENCE accounting.receipt_draft_details_draft_receipt_detail_id_seq OWNED BY accounting.receipt_draft_details.draft_receipt_detail_id;


--
-- Name: receipt_drafts; Type: TABLE; Schema: accounting; Owner: -
--

CREATE TABLE accounting.receipt_drafts (
    draft_receipt_id bigint NOT NULL,
    receipt_import_id bigint,
    receipt_name text,
    receipt_image_path text,
    receipt_imported_at timestamp without time zone,
    image_hash_sha256 text,
    draft_status text DEFAULT '取込済み'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: receipt_drafts_draft_receipt_id_seq; Type: SEQUENCE; Schema: accounting; Owner: -
--

CREATE SEQUENCE accounting.receipt_drafts_draft_receipt_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipt_drafts_draft_receipt_id_seq; Type: SEQUENCE OWNED BY; Schema: accounting; Owner: -
--

ALTER SEQUENCE accounting.receipt_drafts_draft_receipt_id_seq OWNED BY accounting.receipt_drafts.draft_receipt_id;


--
-- Name: receipt_imports; Type: TABLE; Schema: accounting; Owner: -
--

CREATE TABLE accounting.receipt_imports (
    id bigint NOT NULL,
    upload_id text,
    wix_item_id text,
    wix_image_url text,
    local_image_file_name text,
    local_image_path text,
    image_hash_sha256 text,
    image_size_bytes bigint,
    original_file_name text,
    captured_at_jst timestamp without time zone,
    imported_at_jst timestamp without time zone,
    import_batch_id text,
    ocr_provider text,
    ocr_raw_text text,
    ocr_line_count integer,
    ocr_word_count integer,
    status text DEFAULT 'imported'::text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: receipt_imports_id_seq; Type: SEQUENCE; Schema: accounting; Owner: -
--

CREATE SEQUENCE accounting.receipt_imports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipt_imports_id_seq; Type: SEQUENCE OWNED BY; Schema: accounting; Owner: -
--

ALTER SEQUENCE accounting.receipt_imports_id_seq OWNED BY accounting.receipt_imports.id;


--
-- Name: receipt_tax_breakdowns; Type: TABLE; Schema: accounting; Owner: -
--

CREATE TABLE accounting.receipt_tax_breakdowns (
    id bigint NOT NULL,
    receipt_ai_draft_id bigint NOT NULL,
    tax_category_id bigint,
    tax_category_name text DEFAULT ''::text NOT NULL,
    tax_rate numeric(6,4) DEFAULT 0 NOT NULL,
    tax_treatment_id bigint,
    tax_treatment_name text DEFAULT ''::text NOT NULL,
    target_amount numeric(14,2),
    tax_amount numeric(14,2),
    ai_confidence numeric(5,4),
    is_confirmed boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: receipt_tax_breakdowns_id_seq; Type: SEQUENCE; Schema: accounting; Owner: -
--

CREATE SEQUENCE accounting.receipt_tax_breakdowns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipt_tax_breakdowns_id_seq; Type: SEQUENCE OWNED BY; Schema: accounting; Owner: -
--

ALTER SEQUENCE accounting.receipt_tax_breakdowns_id_seq OWNED BY accounting.receipt_tax_breakdowns.id;


--
-- Name: receipts; Type: TABLE; Schema: accounting; Owner: -
--

CREATE TABLE accounting.receipts (
    receipt_id bigint NOT NULL,
    source_draft_receipt_id bigint,
    receipt_import_id bigint,
    receipt_name text,
    receipt_image_path text,
    receipt_imported_at timestamp without time zone,
    image_hash_sha256 text,
    saved_status text DEFAULT '本保存済み'::text NOT NULL,
    saved_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: receipts_receipt_id_seq; Type: SEQUENCE; Schema: accounting; Owner: -
--

CREATE SEQUENCE accounting.receipts_receipt_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipts_receipt_id_seq; Type: SEQUENCE OWNED BY; Schema: accounting; Owner: -
--

ALTER SEQUENCE accounting.receipts_receipt_id_seq OWNED BY accounting.receipts.receipt_id;


--
-- Name: account_titles; Type: TABLE; Schema: expenses; Owner: -
--

CREATE TABLE expenses.account_titles (
    account_title_id bigint NOT NULL,
    account_code text,
    account_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: account_titles_account_title_id_seq; Type: SEQUENCE; Schema: expenses; Owner: -
--

CREATE SEQUENCE expenses.account_titles_account_title_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_titles_account_title_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: -
--

ALTER SEQUENCE expenses.account_titles_account_title_id_seq OWNED BY expenses.account_titles.account_title_id;


--
-- Name: departments; Type: TABLE; Schema: expenses; Owner: -
--

CREATE TABLE expenses.departments (
    department_id bigint NOT NULL,
    department_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: departments_department_id_seq; Type: SEQUENCE; Schema: expenses; Owner: -
--

CREATE SEQUENCE expenses.departments_department_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: departments_department_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: -
--

ALTER SEQUENCE expenses.departments_department_id_seq OWNED BY expenses.departments.department_id;


--
-- Name: evidence_types; Type: TABLE; Schema: expenses; Owner: -
--

CREATE TABLE expenses.evidence_types (
    evidence_type_id bigint NOT NULL,
    evidence_type_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: evidence_types_evidence_type_id_seq; Type: SEQUENCE; Schema: expenses; Owner: -
--

CREATE SEQUENCE expenses.evidence_types_evidence_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: evidence_types_evidence_type_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: -
--

ALTER SEQUENCE expenses.evidence_types_evidence_type_id_seq OWNED BY expenses.evidence_types.evidence_type_id;


--
-- Name: expense_details; Type: TABLE; Schema: expenses; Owner: -
--

CREATE TABLE expenses.expense_details (
    detail_id bigint NOT NULL,
    expense_id bigint NOT NULL,
    line_no integer DEFAULT 1 NOT NULL,
    account_title_id bigint,
    account_title_name text,
    description text,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    tax_category_id bigint,
    tax_category_name text,
    tax_rate numeric(6,4) DEFAULT 0 NOT NULL,
    memo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tax_treatment_id bigint,
    tax_treatment_name text
);


--
-- Name: expense_details_detail_id_seq; Type: SEQUENCE; Schema: expenses; Owner: -
--

CREATE SEQUENCE expenses.expense_details_detail_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expense_details_detail_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: -
--

ALTER SEQUENCE expenses.expense_details_detail_id_seq OWNED BY expenses.expense_details.detail_id;


--
-- Name: expense_headers; Type: TABLE; Schema: expenses; Owner: -
--

CREATE TABLE expenses.expense_headers (
    expense_id bigint NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    vendor_id bigint,
    vendor_name text,
    payment_method_id bigint,
    payment_method_name text,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    target_person_id bigint,
    target_person text,
    purpose_id bigint,
    purpose text,
    project_id bigint,
    project_name text,
    department_id bigint,
    department_name text,
    invoice_status text,
    invoice_number text,
    evidence_type text,
    evidence_memo text,
    summary text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expense_headers_expense_id_seq; Type: SEQUENCE; Schema: expenses; Owner: -
--

CREATE SEQUENCE expenses.expense_headers_expense_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expense_headers_expense_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: -
--

ALTER SEQUENCE expenses.expense_headers_expense_id_seq OWNED BY expenses.expense_headers.expense_id;


--
-- Name: invoice_types; Type: TABLE; Schema: expenses; Owner: -
--

CREATE TABLE expenses.invoice_types (
    invoice_type_id bigint NOT NULL,
    invoice_type_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoice_types_invoice_type_id_seq; Type: SEQUENCE; Schema: expenses; Owner: -
--

CREATE SEQUENCE expenses.invoice_types_invoice_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_types_invoice_type_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: -
--

ALTER SEQUENCE expenses.invoice_types_invoice_type_id_seq OWNED BY expenses.invoice_types.invoice_type_id;


--
-- Name: payment_methods; Type: TABLE; Schema: expenses; Owner: -
--

CREATE TABLE expenses.payment_methods (
    payment_method_id bigint NOT NULL,
    method_name text NOT NULL,
    default_credit_account text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_methods_payment_method_id_seq; Type: SEQUENCE; Schema: expenses; Owner: -
--

CREATE SEQUENCE expenses.payment_methods_payment_method_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_methods_payment_method_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: -
--

ALTER SEQUENCE expenses.payment_methods_payment_method_id_seq OWNED BY expenses.payment_methods.payment_method_id;


--
-- Name: projects; Type: TABLE; Schema: expenses; Owner: -
--

CREATE TABLE expenses.projects (
    project_id bigint NOT NULL,
    project_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects_project_id_seq; Type: SEQUENCE; Schema: expenses; Owner: -
--

CREATE SEQUENCE expenses.projects_project_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projects_project_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: -
--

ALTER SEQUENCE expenses.projects_project_id_seq OWNED BY expenses.projects.project_id;


--
-- Name: purposes; Type: TABLE; Schema: expenses; Owner: -
--

CREATE TABLE expenses.purposes (
    purpose_id bigint NOT NULL,
    purpose_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purposes_purpose_id_seq; Type: SEQUENCE; Schema: expenses; Owner: -
--

CREATE SEQUENCE expenses.purposes_purpose_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purposes_purpose_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: -
--

ALTER SEQUENCE expenses.purposes_purpose_id_seq OWNED BY expenses.purposes.purpose_id;


--
-- Name: target_people; Type: TABLE; Schema: expenses; Owner: -
--

CREATE TABLE expenses.target_people (
    target_person_id bigint NOT NULL,
    target_person_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: target_people_target_person_id_seq; Type: SEQUENCE; Schema: expenses; Owner: -
--

CREATE SEQUENCE expenses.target_people_target_person_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: target_people_target_person_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: -
--

ALTER SEQUENCE expenses.target_people_target_person_id_seq OWNED BY expenses.target_people.target_person_id;


--
-- Name: tax_categories; Type: TABLE; Schema: expenses; Owner: -
--

CREATE TABLE expenses.tax_categories (
    tax_category_id bigint NOT NULL,
    tax_name text NOT NULL,
    tax_rate numeric(6,4) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tax_categories_tax_category_id_seq; Type: SEQUENCE; Schema: expenses; Owner: -
--

CREATE SEQUENCE expenses.tax_categories_tax_category_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tax_categories_tax_category_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: -
--

ALTER SEQUENCE expenses.tax_categories_tax_category_id_seq OWNED BY expenses.tax_categories.tax_category_id;


--
-- Name: tax_treatments; Type: TABLE; Schema: expenses; Owner: -
--

CREATE TABLE expenses.tax_treatments (
    tax_treatment_id bigint NOT NULL,
    treatment_name text NOT NULL,
    treatment_code text,
    is_tax_included boolean,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tax_treatments_tax_treatment_id_seq; Type: SEQUENCE; Schema: expenses; Owner: -
--

CREATE SEQUENCE expenses.tax_treatments_tax_treatment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tax_treatments_tax_treatment_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: -
--

ALTER SEQUENCE expenses.tax_treatments_tax_treatment_id_seq OWNED BY expenses.tax_treatments.tax_treatment_id;


--
-- Name: vendors; Type: TABLE; Schema: expenses; Owner: -
--

CREATE TABLE expenses.vendors (
    vendor_id bigint NOT NULL,
    vendor_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vendors_vendor_id_seq; Type: SEQUENCE; Schema: expenses; Owner: -
--

CREATE SEQUENCE expenses.vendors_vendor_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vendors_vendor_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: -
--

ALTER SEQUENCE expenses.vendors_vendor_id_seq OWNED BY expenses.vendors.vendor_id;


--
-- Name: schema_migrations; Type: TABLE; Schema: system; Owner: -
--

CREATE TABLE system.schema_migrations (
    version text NOT NULL,
    name text NOT NULL,
    file_name text NOT NULL,
    checksum_sha256 text,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_by text DEFAULT CURRENT_USER NOT NULL,
    memo text
);


--
-- Name: receipt_ai_drafts id; Type: DEFAULT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_ai_drafts ALTER COLUMN id SET DEFAULT nextval('accounting.receipt_ai_drafts_id_seq'::regclass);


--
-- Name: receipt_detail_breakdowns receipt_detail_breakdown_id; Type: DEFAULT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_detail_breakdowns ALTER COLUMN receipt_detail_breakdown_id SET DEFAULT nextval('accounting.receipt_detail_breakdowns_receipt_detail_breakdown_id_seq'::regclass);


--
-- Name: receipt_details receipt_detail_id; Type: DEFAULT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_details ALTER COLUMN receipt_detail_id SET DEFAULT nextval('accounting.receipt_details_receipt_detail_id_seq'::regclass);


--
-- Name: receipt_draft_detail_breakdowns draft_receipt_detail_breakdown_id; Type: DEFAULT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_detail_breakdowns ALTER COLUMN draft_receipt_detail_breakdown_id SET DEFAULT nextval('accounting.receipt_draft_detail_breakdow_draft_receipt_detail_breakdow_seq'::regclass);


--
-- Name: receipt_draft_details draft_receipt_detail_id; Type: DEFAULT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_details ALTER COLUMN draft_receipt_detail_id SET DEFAULT nextval('accounting.receipt_draft_details_draft_receipt_detail_id_seq'::regclass);


--
-- Name: receipt_drafts draft_receipt_id; Type: DEFAULT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_drafts ALTER COLUMN draft_receipt_id SET DEFAULT nextval('accounting.receipt_drafts_draft_receipt_id_seq'::regclass);


--
-- Name: receipt_imports id; Type: DEFAULT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_imports ALTER COLUMN id SET DEFAULT nextval('accounting.receipt_imports_id_seq'::regclass);


--
-- Name: receipt_tax_breakdowns id; Type: DEFAULT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_tax_breakdowns ALTER COLUMN id SET DEFAULT nextval('accounting.receipt_tax_breakdowns_id_seq'::regclass);


--
-- Name: receipts receipt_id; Type: DEFAULT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipts ALTER COLUMN receipt_id SET DEFAULT nextval('accounting.receipts_receipt_id_seq'::regclass);


--
-- Name: account_titles account_title_id; Type: DEFAULT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.account_titles ALTER COLUMN account_title_id SET DEFAULT nextval('expenses.account_titles_account_title_id_seq'::regclass);


--
-- Name: departments department_id; Type: DEFAULT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.departments ALTER COLUMN department_id SET DEFAULT nextval('expenses.departments_department_id_seq'::regclass);


--
-- Name: evidence_types evidence_type_id; Type: DEFAULT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.evidence_types ALTER COLUMN evidence_type_id SET DEFAULT nextval('expenses.evidence_types_evidence_type_id_seq'::regclass);


--
-- Name: expense_details detail_id; Type: DEFAULT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.expense_details ALTER COLUMN detail_id SET DEFAULT nextval('expenses.expense_details_detail_id_seq'::regclass);


--
-- Name: expense_headers expense_id; Type: DEFAULT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.expense_headers ALTER COLUMN expense_id SET DEFAULT nextval('expenses.expense_headers_expense_id_seq'::regclass);


--
-- Name: invoice_types invoice_type_id; Type: DEFAULT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.invoice_types ALTER COLUMN invoice_type_id SET DEFAULT nextval('expenses.invoice_types_invoice_type_id_seq'::regclass);


--
-- Name: payment_methods payment_method_id; Type: DEFAULT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.payment_methods ALTER COLUMN payment_method_id SET DEFAULT nextval('expenses.payment_methods_payment_method_id_seq'::regclass);


--
-- Name: projects project_id; Type: DEFAULT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.projects ALTER COLUMN project_id SET DEFAULT nextval('expenses.projects_project_id_seq'::regclass);


--
-- Name: purposes purpose_id; Type: DEFAULT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.purposes ALTER COLUMN purpose_id SET DEFAULT nextval('expenses.purposes_purpose_id_seq'::regclass);


--
-- Name: target_people target_person_id; Type: DEFAULT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.target_people ALTER COLUMN target_person_id SET DEFAULT nextval('expenses.target_people_target_person_id_seq'::regclass);


--
-- Name: tax_categories tax_category_id; Type: DEFAULT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.tax_categories ALTER COLUMN tax_category_id SET DEFAULT nextval('expenses.tax_categories_tax_category_id_seq'::regclass);


--
-- Name: tax_treatments tax_treatment_id; Type: DEFAULT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.tax_treatments ALTER COLUMN tax_treatment_id SET DEFAULT nextval('expenses.tax_treatments_tax_treatment_id_seq'::regclass);


--
-- Name: vendors vendor_id; Type: DEFAULT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.vendors ALTER COLUMN vendor_id SET DEFAULT nextval('expenses.vendors_vendor_id_seq'::regclass);


--
-- Name: receipt_ai_drafts receipt_ai_drafts_pkey; Type: CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_ai_drafts
    ADD CONSTRAINT receipt_ai_drafts_pkey PRIMARY KEY (id);


--
-- Name: receipt_detail_breakdowns receipt_detail_breakdowns_pkey; Type: CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_detail_breakdowns
    ADD CONSTRAINT receipt_detail_breakdowns_pkey PRIMARY KEY (receipt_detail_breakdown_id);


--
-- Name: receipt_details receipt_details_pkey; Type: CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_details
    ADD CONSTRAINT receipt_details_pkey PRIMARY KEY (receipt_detail_id);


--
-- Name: receipt_draft_detail_breakdowns receipt_draft_detail_breakdowns_pkey; Type: CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_detail_breakdowns
    ADD CONSTRAINT receipt_draft_detail_breakdowns_pkey PRIMARY KEY (draft_receipt_detail_breakdown_id);


--
-- Name: receipt_draft_details receipt_draft_details_pkey; Type: CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_details
    ADD CONSTRAINT receipt_draft_details_pkey PRIMARY KEY (draft_receipt_detail_id);


--
-- Name: receipt_drafts receipt_drafts_pkey; Type: CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_drafts
    ADD CONSTRAINT receipt_drafts_pkey PRIMARY KEY (draft_receipt_id);


--
-- Name: receipt_imports receipt_imports_pkey; Type: CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_imports
    ADD CONSTRAINT receipt_imports_pkey PRIMARY KEY (id);


--
-- Name: receipt_tax_breakdowns receipt_tax_breakdowns_pkey; Type: CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_tax_breakdowns
    ADD CONSTRAINT receipt_tax_breakdowns_pkey PRIMARY KEY (id);


--
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (receipt_id);


--
-- Name: account_titles account_titles_pkey; Type: CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.account_titles
    ADD CONSTRAINT account_titles_pkey PRIMARY KEY (account_title_id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (department_id);


--
-- Name: evidence_types evidence_types_pkey; Type: CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.evidence_types
    ADD CONSTRAINT evidence_types_pkey PRIMARY KEY (evidence_type_id);


--
-- Name: expense_details expense_details_pkey; Type: CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.expense_details
    ADD CONSTRAINT expense_details_pkey PRIMARY KEY (detail_id);


--
-- Name: expense_headers expense_headers_pkey; Type: CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.expense_headers
    ADD CONSTRAINT expense_headers_pkey PRIMARY KEY (expense_id);


--
-- Name: invoice_types invoice_types_pkey; Type: CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.invoice_types
    ADD CONSTRAINT invoice_types_pkey PRIMARY KEY (invoice_type_id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (payment_method_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (project_id);


--
-- Name: purposes purposes_pkey; Type: CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.purposes
    ADD CONSTRAINT purposes_pkey PRIMARY KEY (purpose_id);


--
-- Name: target_people target_people_pkey; Type: CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.target_people
    ADD CONSTRAINT target_people_pkey PRIMARY KEY (target_person_id);


--
-- Name: tax_categories tax_categories_pkey; Type: CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.tax_categories
    ADD CONSTRAINT tax_categories_pkey PRIMARY KEY (tax_category_id);


--
-- Name: tax_treatments tax_treatments_pkey; Type: CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.tax_treatments
    ADD CONSTRAINT tax_treatments_pkey PRIMARY KEY (tax_treatment_id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (vendor_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: system; Owner: -
--

ALTER TABLE ONLY system.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: idx_receipt_ai_drafts_receipt_import_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX idx_receipt_ai_drafts_receipt_import_id ON accounting.receipt_ai_drafts USING btree (receipt_import_id);


--
-- Name: idx_receipt_ai_drafts_status; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX idx_receipt_ai_drafts_status ON accounting.receipt_ai_drafts USING btree (status);


--
-- Name: ix_receipt_ai_drafts_receipt_import_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipt_ai_drafts_receipt_import_id ON accounting.receipt_ai_drafts USING btree (receipt_import_id);


--
-- Name: ix_receipt_breakdowns_detail_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipt_breakdowns_detail_id ON accounting.receipt_detail_breakdowns USING btree (receipt_detail_id);


--
-- Name: ix_receipt_breakdowns_receipt_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipt_breakdowns_receipt_id ON accounting.receipt_detail_breakdowns USING btree (receipt_id);


--
-- Name: ix_receipt_breakdowns_source_draft_breakdown_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipt_breakdowns_source_draft_breakdown_id ON accounting.receipt_detail_breakdowns USING btree (source_draft_receipt_detail_breakdown_id);


--
-- Name: ix_receipt_details_receipt_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipt_details_receipt_id ON accounting.receipt_details USING btree (receipt_id);


--
-- Name: ix_receipt_details_source_draft_detail_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipt_details_source_draft_detail_id ON accounting.receipt_details USING btree (source_draft_receipt_detail_id);


--
-- Name: ix_receipt_draft_breakdowns_detail_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipt_draft_breakdowns_detail_id ON accounting.receipt_draft_detail_breakdowns USING btree (draft_receipt_detail_id);


--
-- Name: ix_receipt_draft_breakdowns_draft_receipt_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipt_draft_breakdowns_draft_receipt_id ON accounting.receipt_draft_detail_breakdowns USING btree (draft_receipt_id);


--
-- Name: ix_receipt_draft_details_draft_receipt_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipt_draft_details_draft_receipt_id ON accounting.receipt_draft_details USING btree (draft_receipt_id);


--
-- Name: ix_receipt_draft_details_import_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipt_draft_details_import_id ON accounting.receipt_draft_details USING btree (receipt_import_id);


--
-- Name: ix_receipt_drafts_hash; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipt_drafts_hash ON accounting.receipt_drafts USING btree (image_hash_sha256);


--
-- Name: ix_receipt_drafts_import_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipt_drafts_import_id ON accounting.receipt_drafts USING btree (receipt_import_id);


--
-- Name: ix_receipts_hash; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipts_hash ON accounting.receipts USING btree (image_hash_sha256);


--
-- Name: ix_receipts_import_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipts_import_id ON accounting.receipts USING btree (receipt_import_id);


--
-- Name: ix_receipts_source_draft_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX ix_receipts_source_draft_id ON accounting.receipts USING btree (source_draft_receipt_id);


--
-- Name: receipt_tax_breakdowns_category_idx; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX receipt_tax_breakdowns_category_idx ON accounting.receipt_tax_breakdowns USING btree (tax_category_id);


--
-- Name: receipt_tax_breakdowns_draft_idx; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX receipt_tax_breakdowns_draft_idx ON accounting.receipt_tax_breakdowns USING btree (receipt_ai_draft_id);


--
-- Name: receipt_tax_breakdowns_treatment_idx; Type: INDEX; Schema: accounting; Owner: -
--

CREATE INDEX receipt_tax_breakdowns_treatment_idx ON accounting.receipt_tax_breakdowns USING btree (tax_treatment_id);


--
-- Name: ux_receipt_imports_hash; Type: INDEX; Schema: accounting; Owner: -
--

CREATE UNIQUE INDEX ux_receipt_imports_hash ON accounting.receipt_imports USING btree (image_hash_sha256) WHERE (image_hash_sha256 IS NOT NULL);


--
-- Name: ux_receipt_imports_upload_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE UNIQUE INDEX ux_receipt_imports_upload_id ON accounting.receipt_imports USING btree (upload_id) WHERE (upload_id IS NOT NULL);


--
-- Name: ux_receipt_imports_wix_item_id; Type: INDEX; Schema: accounting; Owner: -
--

CREATE UNIQUE INDEX ux_receipt_imports_wix_item_id ON accounting.receipt_imports USING btree (wix_item_id) WHERE (wix_item_id IS NOT NULL);


--
-- Name: account_titles_account_name_uidx; Type: INDEX; Schema: expenses; Owner: -
--

CREATE UNIQUE INDEX account_titles_account_name_uidx ON expenses.account_titles USING btree (account_name);


--
-- Name: departments_department_name_uidx; Type: INDEX; Schema: expenses; Owner: -
--

CREATE UNIQUE INDEX departments_department_name_uidx ON expenses.departments USING btree (department_name);


--
-- Name: payment_methods_method_name_uidx; Type: INDEX; Schema: expenses; Owner: -
--

CREATE UNIQUE INDEX payment_methods_method_name_uidx ON expenses.payment_methods USING btree (method_name);


--
-- Name: projects_project_name_uidx; Type: INDEX; Schema: expenses; Owner: -
--

CREATE UNIQUE INDEX projects_project_name_uidx ON expenses.projects USING btree (project_name);


--
-- Name: purposes_purpose_name_uidx; Type: INDEX; Schema: expenses; Owner: -
--

CREATE UNIQUE INDEX purposes_purpose_name_uidx ON expenses.purposes USING btree (purpose_name);


--
-- Name: target_people_target_person_name_uidx; Type: INDEX; Schema: expenses; Owner: -
--

CREATE UNIQUE INDEX target_people_target_person_name_uidx ON expenses.target_people USING btree (target_person_name);


--
-- Name: tax_categories_tax_name_uidx; Type: INDEX; Schema: expenses; Owner: -
--

CREATE UNIQUE INDEX tax_categories_tax_name_uidx ON expenses.tax_categories USING btree (tax_name);


--
-- Name: tax_treatments_treatment_name_uidx; Type: INDEX; Schema: expenses; Owner: -
--

CREATE UNIQUE INDEX tax_treatments_treatment_name_uidx ON expenses.tax_treatments USING btree (treatment_name);


--
-- Name: vendors_vendor_name_uidx; Type: INDEX; Schema: expenses; Owner: -
--

CREATE UNIQUE INDEX vendors_vendor_name_uidx ON expenses.vendors USING btree (vendor_name);


--
-- Name: receipt_ai_drafts receipt_ai_drafts_payment_method_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_ai_drafts
    ADD CONSTRAINT receipt_ai_drafts_payment_method_fkey FOREIGN KEY (payment_method_id) REFERENCES expenses.payment_methods(payment_method_id);


--
-- Name: receipt_ai_drafts receipt_ai_drafts_receipt_import_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_ai_drafts
    ADD CONSTRAINT receipt_ai_drafts_receipt_import_id_fkey FOREIGN KEY (receipt_import_id) REFERENCES accounting.receipt_imports(id) ON DELETE CASCADE;


--
-- Name: receipt_detail_breakdowns receipt_detail_breakdowns_receipt_detail_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_detail_breakdowns
    ADD CONSTRAINT receipt_detail_breakdowns_receipt_detail_id_fkey FOREIGN KEY (receipt_detail_id) REFERENCES accounting.receipt_details(receipt_detail_id) ON DELETE CASCADE;


--
-- Name: receipt_detail_breakdowns receipt_detail_breakdowns_receipt_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_detail_breakdowns
    ADD CONSTRAINT receipt_detail_breakdowns_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES accounting.receipts(receipt_id) ON DELETE CASCADE;


--
-- Name: receipt_detail_breakdowns receipt_detail_breakdowns_source_draft_receipt_detail_brea_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_detail_breakdowns
    ADD CONSTRAINT receipt_detail_breakdowns_source_draft_receipt_detail_brea_fkey FOREIGN KEY (source_draft_receipt_detail_breakdown_id) REFERENCES accounting.receipt_draft_detail_breakdowns(draft_receipt_detail_breakdown_id) ON DELETE SET NULL;


--
-- Name: receipt_detail_breakdowns receipt_detail_breakdowns_tax_category_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_detail_breakdowns
    ADD CONSTRAINT receipt_detail_breakdowns_tax_category_id_fkey FOREIGN KEY (tax_category_id) REFERENCES expenses.tax_categories(tax_category_id);


--
-- Name: receipt_detail_breakdowns receipt_detail_breakdowns_tax_treatment_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_detail_breakdowns
    ADD CONSTRAINT receipt_detail_breakdowns_tax_treatment_id_fkey FOREIGN KEY (tax_treatment_id) REFERENCES expenses.tax_treatments(tax_treatment_id);


--
-- Name: receipt_details receipt_details_account_title_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_details
    ADD CONSTRAINT receipt_details_account_title_id_fkey FOREIGN KEY (account_title_id) REFERENCES expenses.account_titles(account_title_id);


--
-- Name: receipt_details receipt_details_department_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_details
    ADD CONSTRAINT receipt_details_department_id_fkey FOREIGN KEY (department_id) REFERENCES expenses.departments(department_id);


--
-- Name: receipt_details receipt_details_evidence_type_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_details
    ADD CONSTRAINT receipt_details_evidence_type_id_fkey FOREIGN KEY (evidence_type_id) REFERENCES expenses.evidence_types(evidence_type_id);


--
-- Name: receipt_details receipt_details_invoice_type_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_details
    ADD CONSTRAINT receipt_details_invoice_type_id_fkey FOREIGN KEY (invoice_type_id) REFERENCES expenses.invoice_types(invoice_type_id);


--
-- Name: receipt_details receipt_details_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_details
    ADD CONSTRAINT receipt_details_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES expenses.payment_methods(payment_method_id);


--
-- Name: receipt_details receipt_details_project_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_details
    ADD CONSTRAINT receipt_details_project_id_fkey FOREIGN KEY (project_id) REFERENCES expenses.projects(project_id);


--
-- Name: receipt_details receipt_details_purpose_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_details
    ADD CONSTRAINT receipt_details_purpose_id_fkey FOREIGN KEY (purpose_id) REFERENCES expenses.purposes(purpose_id);


--
-- Name: receipt_details receipt_details_receipt_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_details
    ADD CONSTRAINT receipt_details_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES accounting.receipts(receipt_id) ON DELETE CASCADE;


--
-- Name: receipt_details receipt_details_source_draft_receipt_detail_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_details
    ADD CONSTRAINT receipt_details_source_draft_receipt_detail_id_fkey FOREIGN KEY (source_draft_receipt_detail_id) REFERENCES accounting.receipt_draft_details(draft_receipt_detail_id) ON DELETE SET NULL;


--
-- Name: receipt_details receipt_details_target_person_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_details
    ADD CONSTRAINT receipt_details_target_person_id_fkey FOREIGN KEY (target_person_id) REFERENCES expenses.target_people(target_person_id);


--
-- Name: receipt_draft_detail_breakdowns receipt_draft_detail_breakdowns_draft_receipt_detail_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_detail_breakdowns
    ADD CONSTRAINT receipt_draft_detail_breakdowns_draft_receipt_detail_id_fkey FOREIGN KEY (draft_receipt_detail_id) REFERENCES accounting.receipt_draft_details(draft_receipt_detail_id) ON DELETE CASCADE;


--
-- Name: receipt_draft_detail_breakdowns receipt_draft_detail_breakdowns_draft_receipt_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_detail_breakdowns
    ADD CONSTRAINT receipt_draft_detail_breakdowns_draft_receipt_id_fkey FOREIGN KEY (draft_receipt_id) REFERENCES accounting.receipt_drafts(draft_receipt_id) ON DELETE CASCADE;


--
-- Name: receipt_draft_detail_breakdowns receipt_draft_detail_breakdowns_tax_category_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_detail_breakdowns
    ADD CONSTRAINT receipt_draft_detail_breakdowns_tax_category_id_fkey FOREIGN KEY (tax_category_id) REFERENCES expenses.tax_categories(tax_category_id);


--
-- Name: receipt_draft_detail_breakdowns receipt_draft_detail_breakdowns_tax_treatment_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_detail_breakdowns
    ADD CONSTRAINT receipt_draft_detail_breakdowns_tax_treatment_id_fkey FOREIGN KEY (tax_treatment_id) REFERENCES expenses.tax_treatments(tax_treatment_id);


--
-- Name: receipt_draft_details receipt_draft_details_account_title_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_details
    ADD CONSTRAINT receipt_draft_details_account_title_id_fkey FOREIGN KEY (account_title_id) REFERENCES expenses.account_titles(account_title_id);


--
-- Name: receipt_draft_details receipt_draft_details_department_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_details
    ADD CONSTRAINT receipt_draft_details_department_id_fkey FOREIGN KEY (department_id) REFERENCES expenses.departments(department_id);


--
-- Name: receipt_draft_details receipt_draft_details_draft_receipt_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_details
    ADD CONSTRAINT receipt_draft_details_draft_receipt_id_fkey FOREIGN KEY (draft_receipt_id) REFERENCES accounting.receipt_drafts(draft_receipt_id) ON DELETE CASCADE;


--
-- Name: receipt_draft_details receipt_draft_details_evidence_type_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_details
    ADD CONSTRAINT receipt_draft_details_evidence_type_id_fkey FOREIGN KEY (evidence_type_id) REFERENCES expenses.evidence_types(evidence_type_id);


--
-- Name: receipt_draft_details receipt_draft_details_invoice_type_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_details
    ADD CONSTRAINT receipt_draft_details_invoice_type_id_fkey FOREIGN KEY (invoice_type_id) REFERENCES expenses.invoice_types(invoice_type_id);


--
-- Name: receipt_draft_details receipt_draft_details_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_details
    ADD CONSTRAINT receipt_draft_details_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES expenses.payment_methods(payment_method_id);


--
-- Name: receipt_draft_details receipt_draft_details_project_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_details
    ADD CONSTRAINT receipt_draft_details_project_id_fkey FOREIGN KEY (project_id) REFERENCES expenses.projects(project_id);


--
-- Name: receipt_draft_details receipt_draft_details_purpose_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_details
    ADD CONSTRAINT receipt_draft_details_purpose_id_fkey FOREIGN KEY (purpose_id) REFERENCES expenses.purposes(purpose_id);


--
-- Name: receipt_draft_details receipt_draft_details_receipt_import_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_details
    ADD CONSTRAINT receipt_draft_details_receipt_import_id_fkey FOREIGN KEY (receipt_import_id) REFERENCES accounting.receipt_imports(id) ON DELETE SET NULL;


--
-- Name: receipt_draft_details receipt_draft_details_target_person_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_draft_details
    ADD CONSTRAINT receipt_draft_details_target_person_id_fkey FOREIGN KEY (target_person_id) REFERENCES expenses.target_people(target_person_id);


--
-- Name: receipt_drafts receipt_drafts_receipt_import_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_drafts
    ADD CONSTRAINT receipt_drafts_receipt_import_id_fkey FOREIGN KEY (receipt_import_id) REFERENCES accounting.receipt_imports(id) ON DELETE SET NULL;


--
-- Name: receipt_tax_breakdowns receipt_tax_breakdowns_category_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_tax_breakdowns
    ADD CONSTRAINT receipt_tax_breakdowns_category_fkey FOREIGN KEY (tax_category_id) REFERENCES expenses.tax_categories(tax_category_id);


--
-- Name: receipt_tax_breakdowns receipt_tax_breakdowns_draft_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_tax_breakdowns
    ADD CONSTRAINT receipt_tax_breakdowns_draft_fkey FOREIGN KEY (receipt_ai_draft_id) REFERENCES accounting.receipt_ai_drafts(id) ON DELETE CASCADE;


--
-- Name: receipt_tax_breakdowns receipt_tax_breakdowns_treatment_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipt_tax_breakdowns
    ADD CONSTRAINT receipt_tax_breakdowns_treatment_fkey FOREIGN KEY (tax_treatment_id) REFERENCES expenses.tax_treatments(tax_treatment_id);


--
-- Name: receipts receipts_receipt_import_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipts
    ADD CONSTRAINT receipts_receipt_import_id_fkey FOREIGN KEY (receipt_import_id) REFERENCES accounting.receipt_imports(id) ON DELETE SET NULL;


--
-- Name: receipts receipts_source_draft_receipt_id_fkey; Type: FK CONSTRAINT; Schema: accounting; Owner: -
--

ALTER TABLE ONLY accounting.receipts
    ADD CONSTRAINT receipts_source_draft_receipt_id_fkey FOREIGN KEY (source_draft_receipt_id) REFERENCES accounting.receipt_drafts(draft_receipt_id) ON DELETE SET NULL;


--
-- Name: expense_details expense_details_expense_id_fkey; Type: FK CONSTRAINT; Schema: expenses; Owner: -
--

ALTER TABLE ONLY expenses.expense_details
    ADD CONSTRAINT expense_details_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES expenses.expense_headers(expense_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict LXPJjk2alCs7ldh5xh8ZGI5FW2tcDk7xMOLGVFv4r7eDHWDXTh6igoEHjffEWD7

