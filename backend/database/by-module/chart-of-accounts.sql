-- ============================================
-- Module: chart-of-accounts
-- Generated: 2026-06-09T16:36:06.337Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.chart_of_accounts
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid,
    account_code character varying(30) COLLATE pg_catalog."default" NOT NULL,
    account_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    account_type character varying(20) COLLATE pg_catalog."default" NOT NULL,
    account_subtype character varying(50) COLLATE pg_catalog."default",
    parent_account_id uuid,
    level integer NOT NULL DEFAULT 1,
    account_path character varying(500) COLLATE pg_catalog."default",
    is_header boolean NOT NULL DEFAULT false,
    is_postable boolean NOT NULL DEFAULT true,
    normal_balance character varying(6) COLLATE pg_catalog."default" NOT NULL,
    currency_code character varying(3) COLLATE pg_catalog."default" NOT NULL DEFAULT 'IDR'::character varying,
    sort_order integer,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid NOT NULL,
    updated_by uuid,
    deleted_at timestamp without time zone,
    deleted_by uuid,
    CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (id),
    CONSTRAINT uq_coa_code UNIQUE (company_id, account_code)
);

CREATE INDEX IF NOT EXISTS idx_coa_company
    ON public.chart_of_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_coa_parent
    ON public.chart_of_accounts(parent_account_id);

ALTER TABLE IF EXISTS public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_branch_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_company_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;
ALTER TABLE IF EXISTS public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_parent_account_id_fkey FOREIGN KEY (parent_account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


END;