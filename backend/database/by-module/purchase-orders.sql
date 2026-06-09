-- ============================================
-- Module: purchase-orders
-- Generated: 2026-06-09T16:36:06.345Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.purchase_order_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    po_id uuid NOT NULL,
    pr_line_id uuid,
    product_id uuid NOT NULL,
    supplier_product_id uuid,
    qty numeric(20, 4) NOT NULL,
    qty_received numeric(20, 4) NOT NULL DEFAULT 0,
    uom character varying(20) COLLATE pg_catalog."default" NOT NULL,
    unit_price numeric(20, 4) NOT NULL,
    total_price numeric(20, 4) NOT NULL,
    notes text COLLATE pg_catalog."default",
    sort_order integer NOT NULL DEFAULT 0,
    qty_short_closed numeric(20, 4) NOT NULL DEFAULT 0,
    short_close_reason text COLLATE pg_catalog."default",
    CONSTRAINT purchase_order_lines_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_po_lines_po
    ON public.purchase_order_lines(po_id);

ALTER TABLE IF EXISTS public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_po_id_fkey FOREIGN KEY (po_id)
    REFERENCES public.purchase_orders (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_pr_line_id_fkey FOREIGN KEY (pr_line_id)
    REFERENCES public.purchase_request_lines (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_supplier_product_id_fkey FOREIGN KEY (supplier_product_id)
    REFERENCES public.supplier_products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.purchase_orders
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    purchase_request_id uuid NOT NULL,
    po_number character varying(50) COLLATE pg_catalog."default" NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    order_date date NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date date,
    payment_type character varying(10) COLLATE pg_catalog."default" NOT NULL,
    payment_terms_days integer,
    notes text COLLATE pg_catalog."default",
    approved_by uuid,
    approved_at timestamp with time zone,
    cancelled_reason text COLLATE pg_catalog."default",
    total_amount numeric(20, 4) NOT NULL DEFAULT 0,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    payment_term_id integer,
    payment_due_date date,
    CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_orders_company_id_po_number_key UNIQUE (company_id, po_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_company
    ON public.purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_pr
    ON public.purchase_orders(purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier
    ON public.purchase_orders(supplier_id);

ALTER TABLE IF EXISTS public.purchase_orders
    ADD CONSTRAINT purchase_orders_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_orders
    ADD CONSTRAINT purchase_orders_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_orders
    ADD CONSTRAINT purchase_orders_payment_term_id_fkey FOREIGN KEY (payment_term_id)
    REFERENCES public.payment_terms (id_payment_term) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_orders
    ADD CONSTRAINT purchase_orders_purchase_request_id_fkey FOREIGN KEY (purchase_request_id)
    REFERENCES public.purchase_requests (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id)
    REFERENCES public.suppliers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;