-- ============================================
-- Module: bank-statements
-- Generated: 2026-06-09T16:36:06.340Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.bank_statements
(
    id bigserial NOT NULL,
    company_id uuid NOT NULL,
    bank_account_id bigint NOT NULL,
    transaction_date date NOT NULL,
    transaction_time time without time zone,
    reference_number character varying(100) COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default" NOT NULL,
    debit_amount numeric(15, 2) NOT NULL DEFAULT 0,
    credit_amount numeric(15, 2) NOT NULL DEFAULT 0,
    balance numeric(15, 2),
    transaction_type character varying(50) COLLATE pg_catalog."default",
    payment_method_id bigint,
    is_reconciled boolean NOT NULL DEFAULT false,
    source_file character varying(255) COLLATE pg_catalog."default",
    import_id bigint,
    row_number integer,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    is_pending boolean DEFAULT false,
    reconciliation_id uuid,
    reconciliation_group_id uuid,
    cash_deposit_id uuid,
    journal_id uuid,
    bank_mutation_entry_id uuid,
    purpose_id uuid,
    CONSTRAINT bank_statements_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_bs_bank_mutation_entry_id
    ON public.bank_statements(bank_mutation_entry_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_journal_id
    ON public.bank_statements(journal_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_purpose
    ON public.bank_statements(purpose_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_reconciliation_group
    ON public.bank_statements(reconciliation_group_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_cash_deposit_id
    ON public.bank_statements(cash_deposit_id);

ALTER TABLE IF EXISTS public.bank_statements
    ADD CONSTRAINT bank_statements_bank_mutation_entry_id_fkey FOREIGN KEY (bank_mutation_entry_id)
    REFERENCES public.bank_mutation_entries (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.bank_statements
    ADD CONSTRAINT bank_statements_journal_id_fkey FOREIGN KEY (journal_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.bank_statements
    ADD CONSTRAINT bank_statements_purpose_id_fkey FOREIGN KEY (purpose_id)
    REFERENCES public.accounting_purposes (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.bank_statements
    ADD CONSTRAINT bank_statements_reconciliation_group_id_fkey FOREIGN KEY (reconciliation_group_id)
    REFERENCES public.bank_reconciliation_groups (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.bank_statements
    ADD CONSTRAINT fk_bank_account FOREIGN KEY (bank_account_id)
    REFERENCES public.bank_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.bank_statements
    ADD CONSTRAINT fk_bank_statements_cash_deposit FOREIGN KEY (cash_deposit_id)
    REFERENCES public.cash_deposits (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.bank_statement_imports
(
    id bigserial NOT NULL,
    company_id uuid NOT NULL,
    bank_account_id bigint NOT NULL,
    file_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    file_size bigint,
    file_hash character varying(64) COLLATE pg_catalog."default",
    status character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT 'PENDING'::character varying,
    total_rows integer NOT NULL DEFAULT 0,
    processed_rows integer NOT NULL DEFAULT 0,
    failed_rows integer NOT NULL DEFAULT 0,
    date_range_start date,
    date_range_end date,
    error_message text COLLATE pg_catalog."default",
    error_details jsonb,
    analysis_data jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone,
    created_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    job_id uuid,
    duplicate_rows integer DEFAULT 0,
    invalid_rows integer DEFAULT 0,
    filtered_rows integer DEFAULT 0,
    CONSTRAINT bank_statement_imports_pkey PRIMARY KEY (id),
    CONSTRAINT bank_statement_imports_file_hash_key UNIQUE (file_hash)
);

ALTER TABLE IF EXISTS public.bank_statement_imports
    ADD CONSTRAINT bank_statement_imports_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.bank_statement_imports
    ADD CONSTRAINT fk_bank_account FOREIGN KEY (bank_account_id)
    REFERENCES public.bank_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


END;