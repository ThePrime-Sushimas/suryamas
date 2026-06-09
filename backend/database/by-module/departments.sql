-- ============================================
-- Module: departments
-- Generated: 2026-06-09T16:36:06.355Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.departments
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    department_code character varying(20) COLLATE pg_catalog."default" NOT NULL,
    department_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT departments_pkey PRIMARY KEY (id),
    CONSTRAINT departments_company_id_department_code_key UNIQUE (company_id, department_code)
);

CREATE INDEX IF NOT EXISTS idx_departments_company
    ON public.departments(company_id);

ALTER TABLE IF EXISTS public.departments
    ADD CONSTRAINT departments_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;