-- ============================================
-- Module: bank-accounts
-- Generated: 2026-06-09T16:36:06.336Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.bank_accounts
(
    id serial NOT NULL,
    bank_id integer NOT NULL,
    account_name character varying(150) COLLATE pg_catalog."default" NOT NULL,
    account_number character varying(50) COLLATE pg_catalog."default" NOT NULL,
    owner_type character varying COLLATE pg_catalog."default" NOT NULL,
    owner_id character varying(50) COLLATE pg_catalog."default" NOT NULL,
    currency character(3) COLLATE pg_catalog."default" NOT NULL DEFAULT 'IDR'::bpchar,
    is_primary boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    deleted_by uuid,
    verified_by uuid,
    coa_account_id uuid,
    CONSTRAINT bank_accounts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_bank_id
    ON public.bank_accounts(bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_coa
    ON public.bank_accounts(coa_account_id);

ALTER TABLE IF EXISTS public.bank_accounts
    ADD CONSTRAINT bank_accounts_bank_id_fkey FOREIGN KEY (bank_id)
    REFERENCES public.banks (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.bank_accounts
    ADD CONSTRAINT bank_accounts_coa_account_id_fkey FOREIGN KEY (coa_account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.bank_accounts
    ADD CONSTRAINT bank_accounts_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES public.employees (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.bank_accounts
    ADD CONSTRAINT bank_accounts_verified_by_fkey FOREIGN KEY (verified_by)
    REFERENCES public.employees (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.banks
(
    id serial NOT NULL,
    bank_code character varying(20) COLLATE pg_catalog."default" NOT NULL,
    bank_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT banks_pkey PRIMARY KEY (id),
    CONSTRAINT banks_bank_code_key UNIQUE (bank_code)
);


END;