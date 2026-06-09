-- ============================================
-- Module: goods-processing
-- Generated: 2026-06-09T16:36:06.344Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.goods_processing_outputs
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    goods_processing_id uuid NOT NULL,
    input_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty_output numeric(20, 4) NOT NULL,
    uom character varying(30) COLLATE pg_catalog."default" NOT NULL,
    is_waste boolean NOT NULL DEFAULT false,
    waste_reason text COLLATE pg_catalog."default",
    photo_urls text[] COLLATE pg_catalog."default",
    unit_cost numeric(20, 4),
    allocated_cost numeric(20, 4),
    stock_movement_id uuid,
    purchase_invoice_line_id uuid,
    sort_order integer NOT NULL DEFAULT 0,
    warehouse_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    condition_status text COLLATE pg_catalog."default",
    actual_qty numeric(12, 4),
    flagged_for_return boolean NOT NULL DEFAULT false,
    return_reason text COLLATE pg_catalog."default",
    return_resolved_at timestamp with time zone,
    return_resolved_by uuid,
    actual_uom text COLLATE pg_catalog."default",
    created_by uuid,
    updated_by uuid,
    CONSTRAINT goods_processing_outputs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_gp_outputs_processing
    ON public.goods_processing_outputs(goods_processing_id);
CREATE INDEX IF NOT EXISTS idx_gp_outputs_input
    ON public.goods_processing_outputs(input_id);
CREATE INDEX IF NOT EXISTS idx_gp_outputs_product
    ON public.goods_processing_outputs(product_id);

ALTER TABLE IF EXISTS public.goods_processing_outputs
    ADD CONSTRAINT goods_processing_outputs_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_processing_outputs
    ADD CONSTRAINT goods_processing_outputs_goods_processing_id_fkey FOREIGN KEY (goods_processing_id)
    REFERENCES public.goods_processing (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.goods_processing_outputs
    ADD CONSTRAINT goods_processing_outputs_input_id_fkey FOREIGN KEY (input_id)
    REFERENCES public.goods_processing_inputs (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.goods_processing_outputs
    ADD CONSTRAINT goods_processing_outputs_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_processing_outputs
    ADD CONSTRAINT goods_processing_outputs_return_resolved_by_fkey FOREIGN KEY (return_resolved_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_processing_outputs
    ADD CONSTRAINT goods_processing_outputs_stock_movement_id_fkey FOREIGN KEY (stock_movement_id)
    REFERENCES public.stock_movements (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_processing_outputs
    ADD CONSTRAINT goods_processing_outputs_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_processing_outputs
    ADD CONSTRAINT goods_processing_outputs_warehouse_id_fkey FOREIGN KEY (warehouse_id)
    REFERENCES public.warehouses (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.goods_processing
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    goods_receipt_id uuid NOT NULL,
    processing_number character varying(50) COLLATE pg_catalog."default" NOT NULL,
    processing_date date NOT NULL DEFAULT CURRENT_DATE,
    processing_type character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'PASS_THROUGH'::character varying,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    notes text COLLATE pg_catalog."default",
    rejection_reason text COLLATE pg_catalog."default",
    processed_by uuid,
    processed_at timestamp with time zone,
    qc_confirmed_by uuid,
    qc_confirmed_at timestamp with time zone,
    rejected_by uuid,
    rejected_at timestamp with time zone,
    total_input_qty numeric(20, 4),
    total_output_qty numeric(20, 4),
    total_waste_qty numeric(20, 4),
    yield_percentage numeric(5, 2),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT goods_processing_pkey PRIMARY KEY (id),
    CONSTRAINT goods_processing_company_id_processing_number_key UNIQUE (company_id, processing_number)
);

CREATE INDEX IF NOT EXISTS idx_goods_processing_company
    ON public.goods_processing(company_id);
CREATE INDEX IF NOT EXISTS idx_goods_processing_gr
    ON public.goods_processing(goods_receipt_id);

ALTER TABLE IF EXISTS public.goods_processing
    ADD CONSTRAINT goods_processing_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_processing
    ADD CONSTRAINT goods_processing_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_processing
    ADD CONSTRAINT goods_processing_goods_receipt_id_fkey FOREIGN KEY (goods_receipt_id)
    REFERENCES public.goods_receipts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_processing
    ADD CONSTRAINT goods_processing_warehouse_id_fkey FOREIGN KEY (warehouse_id)
    REFERENCES public.warehouses (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.goods_processing_inputs
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    goods_processing_id uuid NOT NULL,
    gr_line_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty_input numeric(20, 4) NOT NULL,
    uom character varying(30) COLLATE pg_catalog."default" NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'PENDING'::character varying,
    processed_by uuid,
    processed_at timestamp with time zone,
    qc_confirmed_by uuid,
    qc_confirmed_at timestamp with time zone,
    rejected_by uuid,
    rejected_at timestamp with time zone,
    rejection_reason text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT goods_processing_inputs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_gp_inputs_processing
    ON public.goods_processing_inputs(goods_processing_id);
CREATE INDEX IF NOT EXISTS idx_gp_inputs_gr_line
    ON public.goods_processing_inputs(gr_line_id);

ALTER TABLE IF EXISTS public.goods_processing_inputs
    ADD CONSTRAINT goods_processing_inputs_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_processing_inputs
    ADD CONSTRAINT goods_processing_inputs_goods_processing_id_fkey FOREIGN KEY (goods_processing_id)
    REFERENCES public.goods_processing (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.goods_processing_inputs
    ADD CONSTRAINT goods_processing_inputs_gr_line_id_fkey FOREIGN KEY (gr_line_id)
    REFERENCES public.goods_receipt_lines (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_processing_inputs
    ADD CONSTRAINT goods_processing_inputs_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_processing_inputs
    ADD CONSTRAINT goods_processing_inputs_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;