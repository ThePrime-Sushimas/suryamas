-- ============================================
-- Module: reconciliation
-- Generated: 2026-06-09T16:36:06.340Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.bank_reconciliation_groups
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    aggregate_id uuid NOT NULL,
    total_bank_amount numeric(18, 2) NOT NULL,
    aggregate_amount numeric(18, 2) NOT NULL,
    difference numeric(18, 2) NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" DEFAULT 'PENDING'::character varying,
    notes text COLLATE pg_catalog."default",
    reconciled_by character varying(100) COLLATE pg_catalog."default",
    reconciled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT bank_reconciliation_groups_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_recon_groups_aggregate
    ON public.bank_reconciliation_groups(aggregate_id);

ALTER TABLE IF EXISTS public.bank_reconciliation_groups
    ADD CONSTRAINT bank_reconciliation_groups_aggregate_id_fkey FOREIGN KEY (aggregate_id)
    REFERENCES public.aggregated_transactions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.bank_reconciliation_group_details
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL,
    statement_id integer NOT NULL,
    amount numeric(18, 2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bank_reconciliation_group_details_pkey PRIMARY KEY (id),
    CONSTRAINT bank_reconciliation_group_details_group_id_statement_id_key UNIQUE (group_id, statement_id)
);

CREATE INDEX IF NOT EXISTS idx_recon_group_details_group
    ON public.bank_reconciliation_group_details(group_id);
CREATE INDEX IF NOT EXISTS idx_recon_group_details_statement
    ON public.bank_reconciliation_group_details(statement_id);

ALTER TABLE IF EXISTS public.bank_reconciliation_group_details
    ADD CONSTRAINT bank_reconciliation_group_details_group_id_fkey FOREIGN KEY (group_id)
    REFERENCES public.bank_reconciliation_groups (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.bank_reconciliation_group_details
    ADD CONSTRAINT bank_reconciliation_group_details_statement_id_fkey FOREIGN KEY (statement_id)
    REFERENCES public.bank_statements (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.bank_settlement_groups
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    bank_statement_id bigint,
    settlement_number character varying(50) COLLATE pg_catalog."default" NOT NULL,
    settlement_date date NOT NULL,
    payment_method character varying(50) COLLATE pg_catalog."default",
    bank_name character varying(100) COLLATE pg_catalog."default",
    total_statement_amount numeric(18, 2) NOT NULL,
    total_allocated_amount numeric(18, 2) NOT NULL DEFAULT 0,
    difference numeric(18, 2) DEFAULT 0,
    status character varying(20) COLLATE pg_catalog."default" DEFAULT 'PENDING'::character varying,
    notes text COLLATE pg_catalog."default",
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    confirmed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    CONSTRAINT bank_settlement_groups_pkey PRIMARY KEY (id),
    CONSTRAINT bank_settlement_groups_settlement_number_key UNIQUE (settlement_number)
);

CREATE INDEX IF NOT EXISTS idx_bank_settlement_statement
    ON public.bank_settlement_groups(bank_statement_id);

ALTER TABLE IF EXISTS public.bank_settlement_groups
    ADD CONSTRAINT bank_settlement_groups_bank_statement_id_fkey FOREIGN KEY (bank_statement_id)
    REFERENCES public.bank_statements (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.bank_settlement_aggregates
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    settlement_group_id uuid NOT NULL,
    aggregate_id uuid NOT NULL,
    allocated_amount numeric(18, 2) NOT NULL,
    original_amount numeric(18, 2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT bank_settlement_aggregates_pkey PRIMARY KEY (id),
    CONSTRAINT bank_settlement_aggregates_settlement_group_id_aggregate_id_key UNIQUE (settlement_group_id, aggregate_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_settlement_agg_aggregate
    ON public.bank_settlement_aggregates(aggregate_id);
CREATE INDEX IF NOT EXISTS idx_bank_settlement_agg_group
    ON public.bank_settlement_aggregates(settlement_group_id);

ALTER TABLE IF EXISTS public.bank_settlement_aggregates
    ADD CONSTRAINT bank_settlement_aggregates_aggregate_id_fkey FOREIGN KEY (aggregate_id)
    REFERENCES public.aggregated_transactions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.bank_settlement_aggregates
    ADD CONSTRAINT bank_settlement_aggregates_settlement_group_id_fkey FOREIGN KEY (settlement_group_id)
    REFERENCES public.bank_settlement_groups (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.bank_settlement_statements
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    settlement_group_id uuid NOT NULL,
    bank_statement_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bank_settlement_statements_pkey PRIMARY KEY (id),
    CONSTRAINT bank_settlement_statements_settlement_group_id_bank_stateme_key UNIQUE (settlement_group_id, bank_statement_id)
);

CREATE INDEX IF NOT EXISTS idx_bss_statement
    ON public.bank_settlement_statements(bank_statement_id);
CREATE INDEX IF NOT EXISTS idx_bss_group
    ON public.bank_settlement_statements(settlement_group_id);

ALTER TABLE IF EXISTS public.bank_settlement_statements
    ADD CONSTRAINT bank_settlement_statements_bank_statement_id_fkey FOREIGN KEY (bank_statement_id)
    REFERENCES public.bank_statements (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.bank_settlement_statements
    ADD CONSTRAINT bank_settlement_statements_settlement_group_id_fkey FOREIGN KEY (settlement_group_id)
    REFERENCES public.bank_settlement_groups (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.fee_discrepancy_reviews
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    source character varying(20) COLLATE pg_catalog."default" NOT NULL,
    source_id uuid NOT NULL,
    company_id uuid NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'PENDING'::character varying,
    correction_journal_id uuid,
    notes text COLLATE pg_catalog."default",
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT fee_discrepancy_reviews_pkey PRIMARY KEY (id),
    CONSTRAINT fee_discrepancy_reviews_source_source_id_company_id_key UNIQUE (source, source_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_fee_discrepancy_reviews_company
    ON public.fee_discrepancy_reviews(company_id);

ALTER TABLE IF EXISTS public.fee_discrepancy_reviews
    ADD CONSTRAINT fee_discrepancy_reviews_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;