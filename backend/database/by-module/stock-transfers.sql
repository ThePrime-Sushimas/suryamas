-- ============================================
-- Module: stock-transfers
-- Generated: 2026-06-09T16:36:06.353Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.stock_transfers
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    transfer_number character varying(50) COLLATE pg_catalog."default" NOT NULL,
    transfer_type character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'TRANSFER'::character varying,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    source_warehouse_id uuid NOT NULL,
    target_warehouse_id uuid NOT NULL,
    source_branch_id uuid NOT NULL,
    target_branch_id uuid NOT NULL,
    transfer_date date NOT NULL,
    notes text COLLATE pg_catalog."default",
    confirmed_at timestamp with time zone,
    confirmed_by uuid,
    returned_at timestamp with time zone,
    returned_by uuid,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    cancel_reason text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    source_journal_id uuid,
    target_journal_id uuid,
    CONSTRAINT stock_transfers_pkey PRIMARY KEY (id),
    CONSTRAINT stock_transfers_company_id_transfer_number_key UNIQUE (company_id, transfer_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_company
    ON public.stock_transfers(company_id);

ALTER TABLE IF EXISTS public.stock_transfers
    ADD CONSTRAINT stock_transfers_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.stock_transfers
    ADD CONSTRAINT stock_transfers_source_branch_id_fkey FOREIGN KEY (source_branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.stock_transfers
    ADD CONSTRAINT stock_transfers_source_journal_id_fkey FOREIGN KEY (source_journal_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.stock_transfers
    ADD CONSTRAINT stock_transfers_source_warehouse_id_fkey FOREIGN KEY (source_warehouse_id)
    REFERENCES public.warehouses (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.stock_transfers
    ADD CONSTRAINT stock_transfers_target_branch_id_fkey FOREIGN KEY (target_branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.stock_transfers
    ADD CONSTRAINT stock_transfers_target_journal_id_fkey FOREIGN KEY (target_journal_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.stock_transfers
    ADD CONSTRAINT stock_transfers_target_warehouse_id_fkey FOREIGN KEY (target_warehouse_id)
    REFERENCES public.warehouses (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.stock_transfer_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    stock_transfer_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty numeric(20, 4) NOT NULL,
    cost_per_unit numeric(20, 4) NOT NULL DEFAULT 0,
    notes text COLLATE pg_catalog."default",
    sort_order integer NOT NULL DEFAULT 0,
    out_movement_id uuid,
    in_movement_id uuid,
    return_out_movement_id uuid,
    return_in_movement_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT stock_transfer_lines_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_lines_transfer
    ON public.stock_transfer_lines(stock_transfer_id);

ALTER TABLE IF EXISTS public.stock_transfer_lines
    ADD CONSTRAINT stock_transfer_lines_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.stock_transfer_lines
    ADD CONSTRAINT stock_transfer_lines_stock_transfer_id_fkey FOREIGN KEY (stock_transfer_id)
    REFERENCES public.stock_transfers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


END;