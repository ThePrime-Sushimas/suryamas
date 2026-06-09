-- ============================================
-- Module: printers
-- Generated: 2026-06-09T16:36:06.354Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.printers
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid,
    printer_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    ip_address character varying(45) COLLATE pg_catalog."default" NOT NULL,
    port integer NOT NULL DEFAULT 9100,
    paper_width integer NOT NULL DEFAULT 80,
    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT printers_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_printers_branch
    ON public.printers(branch_id);
CREATE INDEX IF NOT EXISTS idx_printers_company
    ON public.printers(company_id);

ALTER TABLE IF EXISTS public.printers
    ADD CONSTRAINT printers_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.printers
    ADD CONSTRAINT printers_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;