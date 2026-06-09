-- ============================================
-- Module: bank-mutation-entries
-- Generated: 2026-06-09T16:36:06.341Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.bank_mutation_entries
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    entry_date date NOT NULL,
    entry_type bank_mutation_entry_type NOT NULL,
    description text COLLATE pg_catalog."default" NOT NULL,
    amount numeric(18, 2) NOT NULL,
    reference_number text COLLATE pg_catalog."default",
    bank_account_id integer,
    coa_id uuid NOT NULL,
    coa_code text COLLATE pg_catalog."default",
    coa_name text COLLATE pg_catalog."default",
    bank_statement_id bigint,
    is_reconciled boolean NOT NULL DEFAULT false,
    reconciled_at timestamp with time zone,
    reconciled_by uuid,
    journal_header_id uuid,
    status bank_mutation_entry_status NOT NULL DEFAULT 'ACTIVE'::bank_mutation_entry_status,
    void_reason text COLLATE pg_catalog."default",
    voided_at timestamp with time zone,
    voided_by uuid,
    notes text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT bank_mutation_entries_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_bme_bank_account_id
    ON public.bank_mutation_entries(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bme_bank_statement
    ON public.bank_mutation_entries(bank_statement_id);

ALTER TABLE IF EXISTS public.bank_mutation_entries
    ADD CONSTRAINT bank_mutation_entries_bank_account_id_fkey FOREIGN KEY (bank_account_id)
    REFERENCES public.bank_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.bank_mutation_entries
    ADD CONSTRAINT bank_mutation_entries_bank_statement_id_fkey FOREIGN KEY (bank_statement_id)
    REFERENCES public.bank_statements (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;