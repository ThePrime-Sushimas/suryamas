-- ============================================
-- Module: cash-deposits
-- Generated: 2026-06-09T16:36:06.341Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.cash_deposits
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    deposit_amount numeric(18, 2) NOT NULL,
    deposit_date date NOT NULL,
    bank_account_id integer NOT NULL,
    reference character varying(100) COLLATE pg_catalog."default",
    bank_statement_id bigint,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'PENDING'::character varying,
    branch_name character varying(255) COLLATE pg_catalog."default",
    payment_method_id integer,
    period_start date,
    period_end date,
    item_count integer NOT NULL DEFAULT 0,
    notes text COLLATE pg_catalog."default",
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,
    proof_url text COLLATE pg_catalog."default",
    deposited_at timestamp with time zone,
    deposited_by uuid,
    large_amount numeric(18, 2),
    owner_top_up numeric(18, 2) DEFAULT 0,
    CONSTRAINT cash_deposits_pkey PRIMARY KEY (id)
);


END;