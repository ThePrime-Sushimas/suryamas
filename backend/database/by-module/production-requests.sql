-- ============================================
-- Module: production-requests
-- Generated: 2026-06-09T16:36:06.354Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.production_requests
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    request_number character varying(30) COLLATE pg_catalog."default" NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    requesting_branch_id uuid NOT NULL,
    fulfilling_branch_id uuid NOT NULL,
    request_date date NOT NULL,
    notes text COLLATE pg_catalog."default",
    accepted_at timestamp with time zone,
    accepted_by uuid,
    accept_notes text COLLATE pg_catalog."default",
    received_at timestamp with time zone,
    received_by uuid,
    receive_notes text COLLATE pg_catalog."default",
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    cancel_reason text COLLATE pg_catalog."default",
    stock_transfer_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT production_requests_pkey PRIMARY KEY (id),
    CONSTRAINT production_requests_company_id_request_number_key UNIQUE (company_id, request_number)
);

CREATE INDEX IF NOT EXISTS idx_production_requests_company
    ON public.production_requests(company_id);

ALTER TABLE IF EXISTS public.production_requests
    ADD CONSTRAINT production_requests_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.production_requests
    ADD CONSTRAINT production_requests_fulfilling_branch_id_fkey FOREIGN KEY (fulfilling_branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.production_requests
    ADD CONSTRAINT production_requests_requesting_branch_id_fkey FOREIGN KEY (requesting_branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.production_requests
    ADD CONSTRAINT production_requests_stock_transfer_id_fkey FOREIGN KEY (stock_transfer_id)
    REFERENCES public.stock_transfers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.production_request_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    production_request_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty numeric(20, 4) NOT NULL,
    qty_approved numeric(20, 4),
    uom character varying(50) COLLATE pg_catalog."default" NOT NULL,
    notes text COLLATE pg_catalog."default",
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT production_request_lines_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_production_request_lines_request
    ON public.production_request_lines(production_request_id);

ALTER TABLE IF EXISTS public.production_request_lines
    ADD CONSTRAINT production_request_lines_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.production_request_lines
    ADD CONSTRAINT production_request_lines_production_request_id_fkey FOREIGN KEY (production_request_id)
    REFERENCES public.production_requests (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


END;