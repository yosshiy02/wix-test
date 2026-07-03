--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

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
-- Name: expenses; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA expenses;


ALTER SCHEMA expenses OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: expense_details; Type: TABLE; Schema: expenses; Owner: postgres
--

CREATE TABLE expenses.expense_details (
    detail_id bigint NOT NULL,
    expense_id bigint NOT NULL,
    account_title text,
    description text,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    tax_category text,
    memo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE expenses.expense_details OWNER TO postgres;

--
-- Name: expense_details_detail_id_seq; Type: SEQUENCE; Schema: expenses; Owner: postgres
--

CREATE SEQUENCE expenses.expense_details_detail_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE expenses.expense_details_detail_id_seq OWNER TO postgres;

--
-- Name: expense_details_detail_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: postgres
--

ALTER SEQUENCE expenses.expense_details_detail_id_seq OWNED BY expenses.expense_details.detail_id;


--
-- Name: expense_headers; Type: TABLE; Schema: expenses; Owner: postgres
--

CREATE TABLE expenses.expense_headers (
    expense_id bigint NOT NULL,
    expense_date date NOT NULL,
    payee text,
    payment_method text,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    memo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE expenses.expense_headers OWNER TO postgres;

--
-- Name: expense_headers_expense_id_seq; Type: SEQUENCE; Schema: expenses; Owner: postgres
--

CREATE SEQUENCE expenses.expense_headers_expense_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE expenses.expense_headers_expense_id_seq OWNER TO postgres;

--
-- Name: expense_headers_expense_id_seq; Type: SEQUENCE OWNED BY; Schema: expenses; Owner: postgres
--

ALTER SEQUENCE expenses.expense_headers_expense_id_seq OWNED BY expenses.expense_headers.expense_id;


--
-- Name: received_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.received_items (
    id bigint NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    type text,
    amount numeric(12,2),
    name text,
    deal_date date,
    memo text,
    payload jsonb NOT NULL
);


ALTER TABLE public.received_items OWNER TO postgres;

--
-- Name: received_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.received_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.received_items_id_seq OWNER TO postgres;

--
-- Name: received_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.received_items_id_seq OWNED BY public.received_items.id;


--
-- Name: expense_details detail_id; Type: DEFAULT; Schema: expenses; Owner: postgres
--

ALTER TABLE ONLY expenses.expense_details ALTER COLUMN detail_id SET DEFAULT nextval('expenses.expense_details_detail_id_seq'::regclass);


--
-- Name: expense_headers expense_id; Type: DEFAULT; Schema: expenses; Owner: postgres
--

ALTER TABLE ONLY expenses.expense_headers ALTER COLUMN expense_id SET DEFAULT nextval('expenses.expense_headers_expense_id_seq'::regclass);


--
-- Name: received_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.received_items ALTER COLUMN id SET DEFAULT nextval('public.received_items_id_seq'::regclass);


--
-- Name: expense_details expense_details_pkey; Type: CONSTRAINT; Schema: expenses; Owner: postgres
--

ALTER TABLE ONLY expenses.expense_details
    ADD CONSTRAINT expense_details_pkey PRIMARY KEY (detail_id);


--
-- Name: expense_headers expense_headers_pkey; Type: CONSTRAINT; Schema: expenses; Owner: postgres
--

ALTER TABLE ONLY expenses.expense_headers
    ADD CONSTRAINT expense_headers_pkey PRIMARY KEY (expense_id);


--
-- Name: received_items received_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.received_items
    ADD CONSTRAINT received_items_pkey PRIMARY KEY (id);


--
-- Name: expense_details expense_details_expense_id_fkey; Type: FK CONSTRAINT; Schema: expenses; Owner: postgres
--

ALTER TABLE ONLY expenses.expense_details
    ADD CONSTRAINT expense_details_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES expenses.expense_headers(expense_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

