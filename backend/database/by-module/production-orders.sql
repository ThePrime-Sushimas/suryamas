-- ============================================
-- Module: production-orders
-- Generated: 2026-06-09T16:36:06.348Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.production_order_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    production_order_id uuid NOT NULL,
    wip_id uuid NOT NULL,
    wip_name character varying(150) COLLATE pg_catalog."default" NOT NULL,
    wip_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    yield_per_batch numeric(20, 4) NOT NULL,
    uom character varying(20) COLLATE pg_catalog."default" NOT NULL,
    cost_per_batch numeric(20, 4) NOT NULL,
    planned_batch_qty numeric(20, 4) NOT NULL,
    actual_batch_qty numeric(20, 4),
    total_yield numeric(20, 4),
    total_cost numeric(20, 4),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    stock_movement_in_id uuid,
    CONSTRAINT production_order_lines_pkey PRIMARY KEY (id)
);

COMMENT ON COLUMN public.production_order_lines.stock_movement_in_id
    IS 'References IN_PRODUCTION movement untuk hasil WIP yang masuk ke output warehouse. Hanya terisi untuk WIP dengan output_product_id (central kitchen).';

CREATE INDEX IF NOT EXISTS idx_prod_lines_order
    ON public.production_order_lines(production_order_id);

ALTER TABLE IF EXISTS public.production_order_lines
    ADD CONSTRAINT production_order_lines_production_order_id_fkey FOREIGN KEY (production_order_id)
    REFERENCES public.production_orders (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.production_order_lines
    ADD CONSTRAINT production_order_lines_stock_movement_in_id_fkey FOREIGN KEY (stock_movement_in_id)
    REFERENCES public.stock_movements (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.production_order_lines
    ADD CONSTRAINT production_order_lines_wip_id_fkey FOREIGN KEY (wip_id)
    REFERENCES public.wip_items (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.production_orders
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    order_number character varying(50) COLLATE pg_catalog."default" NOT NULL,
    production_date date NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    total_material_cost numeric(20, 4) NOT NULL DEFAULT 0,
    total_waste_cost numeric(20, 4) NOT NULL DEFAULT 0,
    notes text COLLATE pg_catalog."default",
    completed_by uuid,
    completed_at timestamp with time zone,
    voided_by uuid,
    voided_at timestamp with time zone,
    void_reason text COLLATE pg_catalog."default",
    journal_id uuid,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT production_orders_pkey PRIMARY KEY (id),
    CONSTRAINT production_orders_company_id_order_number_key UNIQUE (company_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_production_orders_company
    ON public.production_orders(company_id);

ALTER TABLE IF EXISTS public.production_orders
    ADD CONSTRAINT production_orders_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.production_orders
    ADD CONSTRAINT production_orders_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.production_orders
    ADD CONSTRAINT production_orders_journal_id_fkey FOREIGN KEY (journal_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.production_order_materials
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    production_order_id uuid NOT NULL,
    production_line_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name character varying(150) COLLATE pg_catalog."default" NOT NULL,
    product_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    planned_qty numeric(20, 4) NOT NULL,
    actual_qty numeric(20, 4),
    total_cost numeric(20, 4),
    uom character varying(20) COLLATE pg_catalog."default" NOT NULL,
    cost_per_unit numeric(20, 4) NOT NULL,
    cost_source character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'wip_ingredient'::character varying,
    waste_qty numeric(20, 4) NOT NULL DEFAULT 0,
    waste_reason text COLLATE pg_catalog."default",
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    stock_movement_out_id uuid,
    stock_movement_in_id uuid,
    CONSTRAINT production_order_materials_pkey PRIMARY KEY (id)
);

COMMENT ON COLUMN public.production_order_materials.stock_movement_out_id
    IS 'References the OUT_PRODUCTION stock movement when materials are deducted from warehouse';
COMMENT ON COLUMN public.production_order_materials.stock_movement_in_id
    IS 'References the IN_PRODUCTION stock movement for finished goods output (if applicable)';

CREATE INDEX IF NOT EXISTS idx_prod_materials_product
    ON public.production_order_materials(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_materials_line
    ON public.production_order_materials(production_line_id);
CREATE INDEX IF NOT EXISTS idx_prod_materials_order
    ON public.production_order_materials(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_order_materials_in_movement
    ON public.production_order_materials(stock_movement_in_id);
CREATE INDEX IF NOT EXISTS idx_production_order_materials_out_movement
    ON public.production_order_materials(stock_movement_out_id);

ALTER TABLE IF EXISTS public.production_order_materials
    ADD CONSTRAINT production_order_materials_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.production_order_materials
    ADD CONSTRAINT production_order_materials_production_line_id_fkey FOREIGN KEY (production_line_id)
    REFERENCES public.production_order_lines (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.production_order_materials
    ADD CONSTRAINT production_order_materials_production_order_id_fkey FOREIGN KEY (production_order_id)
    REFERENCES public.production_orders (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.production_order_materials
    ADD CONSTRAINT production_order_materials_stock_movement_in_id_fkey FOREIGN KEY (stock_movement_in_id)
    REFERENCES public.stock_movements (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.production_order_materials
    ADD CONSTRAINT production_order_materials_stock_movement_out_id_fkey FOREIGN KEY (stock_movement_out_id)
    REFERENCES public.stock_movements (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


END;