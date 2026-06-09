-- ============================================
-- Module: warehouses
-- Generated: 2026-06-09T16:36:06.344Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.warehouses
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    warehouse_code character varying(30) COLLATE pg_catalog."default" NOT NULL,
    warehouse_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    warehouse_type character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'MAIN'::character varying,
    is_active boolean NOT NULL DEFAULT true,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT warehouses_pkey PRIMARY KEY (id),
    CONSTRAINT warehouses_company_id_warehouse_code_key UNIQUE (company_id, warehouse_code)
);

CREATE INDEX IF NOT EXISTS idx_warehouses_branch
    ON public.warehouses(branch_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_company
    ON public.warehouses(company_id);

ALTER TABLE IF EXISTS public.warehouses
    ADD CONSTRAINT warehouses_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.warehouses
    ADD CONSTRAINT warehouses_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;