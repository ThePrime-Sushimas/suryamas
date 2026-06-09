-- ============================================
-- Module: purchase-requests
-- Generated: 2026-06-09T16:36:06.345Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.purchase_requests
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    request_number character varying(50) COLLATE pg_catalog."default" NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    request_date date NOT NULL DEFAULT CURRENT_DATE,
    needed_by_date date,
    notes text COLLATE pg_catalog."default",
    requested_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejected_reason text COLLATE pg_catalog."default",
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    priority character varying(10) COLLATE pg_catalog."default" NOT NULL DEFAULT 'normal'::character varying,
    CONSTRAINT purchase_requests_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_requests_company_id_request_number_key UNIQUE (company_id, request_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_branch
    ON public.purchase_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_company
    ON public.purchase_requests(company_id);

ALTER TABLE IF EXISTS public.purchase_requests
    ADD CONSTRAINT purchase_requests_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_requests
    ADD CONSTRAINT purchase_requests_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.purchase_request_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty numeric(20, 4) NOT NULL,
    uom character varying(20) COLLATE pg_catalog."default" NOT NULL,
    supplier_id uuid,
    notes text COLLATE pg_catalog."default",
    sort_order integer NOT NULL DEFAULT 0,
    qty_approved numeric(20, 4),
    CONSTRAINT purchase_request_lines_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_pr_lines_request
    ON public.purchase_request_lines(request_id);

ALTER TABLE IF EXISTS public.purchase_request_lines
    ADD CONSTRAINT purchase_request_lines_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_request_lines
    ADD CONSTRAINT purchase_request_lines_request_id_fkey FOREIGN KEY (request_id)
    REFERENCES public.purchase_requests (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.purchase_request_lines
    ADD CONSTRAINT purchase_request_lines_supplier_id_fkey FOREIGN KEY (supplier_id)
    REFERENCES public.suppliers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;