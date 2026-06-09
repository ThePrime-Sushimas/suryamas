-- ============================================
-- Module: branches
-- Generated: 2026-06-09T16:36:06.337Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.branches
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    branch_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'active'::character varying,
    address text COLLATE pg_catalog."default",
    city character varying(100) COLLATE pg_catalog."default",
    province character varying(100) COLLATE pg_catalog."default",
    postal_code character varying(20) COLLATE pg_catalog."default",
    country character varying(100) COLLATE pg_catalog."default" DEFAULT 'Indonesia'::character varying,
    phone character varying(20) COLLATE pg_catalog."default",
    whatsapp character varying(20) COLLATE pg_catalog."default",
    email character varying(255) COLLATE pg_catalog."default",
    notes text COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    jam_buka time without time zone NOT NULL DEFAULT '10:00:00'::time without time zone,
    jam_tutup time without time zone NOT NULL DEFAULT '22:00:00'::time without time zone,
    hari_operasional jsonb NOT NULL DEFAULT '[]'::jsonb,
    closed_at timestamp without time zone,
    closed_by uuid,
    closed_reason text COLLATE pg_catalog."default",
    closed_date date,
    is_sales boolean,
    CONSTRAINT branches_pkey PRIMARY KEY (id),
    CONSTRAINT branches_branch_code_key UNIQUE (branch_code)
);

COMMENT ON COLUMN public.branches.is_sales
    IS 'menentukan apakah cabang ini termasuk gudang , atau cabang untuk sales';

CREATE INDEX IF NOT EXISTS idx_branches_company_id
    ON public.branches(company_id);

ALTER TABLE IF EXISTS public.branches
    ADD CONSTRAINT branches_closed_by_fkey FOREIGN KEY (closed_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.branches
    ADD CONSTRAINT branches_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.branches
    ADD CONSTRAINT branches_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.branches
    ADD CONSTRAINT branches_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.branch_opname_config
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    variance_threshold_pct numeric(5, 2) NOT NULL DEFAULT 15.00,
    closing_time time without time zone NOT NULL DEFAULT '23:59:00'::time without time zone,
    grace_period_minutes integer NOT NULL DEFAULT 15,
    updated_by uuid,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT branch_opname_config_pkey PRIMARY KEY (id),
    CONSTRAINT branch_opname_config_branch_id_key UNIQUE (branch_id)
);

CREATE INDEX IF NOT EXISTS branch_opname_config_branch_id_key
    ON public.branch_opname_config(branch_id);

ALTER TABLE IF EXISTS public.branch_opname_config
    ADD CONSTRAINT branch_opname_config_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.branch_opname_config
    ADD CONSTRAINT branch_opname_config_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;