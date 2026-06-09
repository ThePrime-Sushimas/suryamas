-- ============================================
-- Module: stock-adjustments
-- Generated: 2026-06-09T16:36:06.354Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.stock_adjustments
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    adjustment_number character varying(30) COLLATE pg_catalog."default" NOT NULL,
    adjustment_type character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'WASTE'::character varying,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    adjustment_date date NOT NULL,
    reason character varying(30) COLLATE pg_catalog."default",
    notes text COLLATE pg_catalog."default",
    input_product_id uuid,
    input_qty numeric(20, 4),
    input_cost_per_unit numeric(20, 4) NOT NULL DEFAULT 0,
    input_movement_id uuid,
    waste_qty numeric(20, 4) NOT NULL DEFAULT 0,
    journal_id uuid,
    confirmed_at timestamp with time zone,
    confirmed_by uuid,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    waste_value numeric(20, 4) NOT NULL DEFAULT 0,
    CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id),
    CONSTRAINT stock_adjustments_company_id_adjustment_number_key UNIQUE (company_id, adjustment_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_company
    ON public.stock_adjustments(company_id);

ALTER TABLE IF EXISTS public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_input_product_id_fkey FOREIGN KEY (input_product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_warehouse_id_fkey FOREIGN KEY (warehouse_id)
    REFERENCES public.warehouses (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.stock_adjustment_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    stock_adjustment_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty numeric(20, 4) NOT NULL,
    cost_per_unit numeric(20, 4) NOT NULL DEFAULT 0,
    movement_id uuid,
    notes text COLLATE pg_catalog."default",
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT stock_adjustment_lines_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustment_lines_adj
    ON public.stock_adjustment_lines(stock_adjustment_id);

ALTER TABLE IF EXISTS public.stock_adjustment_lines
    ADD CONSTRAINT stock_adjustment_lines_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.stock_adjustment_lines
    ADD CONSTRAINT stock_adjustment_lines_stock_adjustment_id_fkey FOREIGN KEY (stock_adjustment_id)
    REFERENCES public.stock_adjustments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.stock_adjustment_outputs
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    stock_adjustment_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty numeric(20, 4) NOT NULL,
    cost_per_unit numeric(20, 4) NOT NULL DEFAULT 0,
    movement_id uuid,
    notes text COLLATE pg_catalog."default",
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT stock_adjustment_outputs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustment_outputs_adj
    ON public.stock_adjustment_outputs(stock_adjustment_id);

ALTER TABLE IF EXISTS public.stock_adjustment_outputs
    ADD CONSTRAINT stock_adjustment_outputs_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.stock_adjustment_outputs
    ADD CONSTRAINT stock_adjustment_outputs_stock_adjustment_id_fkey FOREIGN KEY (stock_adjustment_id)
    REFERENCES public.stock_adjustments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


END;