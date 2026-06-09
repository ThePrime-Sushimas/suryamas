-- ============================================
-- Module: cogs
-- Generated: 2026-06-09T16:36:06.349Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.cogs_calculation_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    calculation_id uuid NOT NULL,
    menu_id uuid,
    menu_name character varying(150) COLLATE pg_catalog."default" NOT NULL,
    category_name character varying(100) COLLATE pg_catalog."default",
    qty_sold numeric(20, 4) NOT NULL,
    cost_per_unit numeric(20, 4) NOT NULL,
    total_cogs numeric(20, 4) NOT NULL,
    revenue numeric(20, 4) NOT NULL DEFAULT 0,
    cogs_percentage numeric(10, 4) NOT NULL DEFAULT 0,
    has_recipe boolean NOT NULL DEFAULT false,
    CONSTRAINT cogs_calculation_lines_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_cogs_lines_calc
    ON public.cogs_calculation_lines(calculation_id);

ALTER TABLE IF EXISTS public.cogs_calculation_lines
    ADD CONSTRAINT cogs_calculation_lines_calculation_id_fkey FOREIGN KEY (calculation_id)
    REFERENCES public.cogs_calculations (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.cogs_calculation_lines
    ADD CONSTRAINT cogs_calculation_lines_menu_id_fkey FOREIGN KEY (menu_id)
    REFERENCES public.menus (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.cogs_calculations
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid,
    calculation_date date NOT NULL DEFAULT CURRENT_DATE,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_food_cogs numeric(20, 4) NOT NULL DEFAULT 0,
    total_beverage_cogs numeric(20, 4) NOT NULL DEFAULT 0,
    total_other_cogs numeric(20, 4) NOT NULL DEFAULT 0,
    total_cogs numeric(20, 4) NOT NULL DEFAULT 0,
    total_revenue numeric(20, 4) NOT NULL DEFAULT 0,
    cogs_percentage numeric(5, 2) NOT NULL DEFAULT 0,
    unmapped_menu_count integer NOT NULL DEFAULT 0,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    superseded_by uuid,
    journal_id uuid,
    notes text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    CONSTRAINT cogs_calculations_pkey PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public.cogs_calculations
    ADD CONSTRAINT cogs_calculations_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.cogs_calculations
    ADD CONSTRAINT cogs_calculations_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.cogs_calculations
    ADD CONSTRAINT cogs_calculations_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.cogs_calculations
    ADD CONSTRAINT cogs_calculations_superseded_by_fkey FOREIGN KEY (superseded_by)
    REFERENCES public.cogs_calculations (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;