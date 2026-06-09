-- ============================================
-- Module: goods-receipts
-- Generated: 2026-06-09T16:36:06.339Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.invoice_verifications
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    gr_id uuid NOT NULL,
    company_id uuid NOT NULL,
    invoice_number character varying(100) COLLATE pg_catalog."default" NOT NULL,
    invoice_date date NOT NULL,
    invoice_photo_url text COLLATE pg_catalog."default" NOT NULL,
    invoice_amount numeric(20, 4) NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'PENDING'::character varying,
    verified_by uuid,
    verified_at timestamp with time zone,
    journal_entry_id uuid,
    notes text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT invoice_verifications_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_verifications_gr
    ON public.invoice_verifications(gr_id);

ALTER TABLE IF EXISTS public.invoice_verifications
    ADD CONSTRAINT invoice_verifications_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.invoice_verifications
    ADD CONSTRAINT invoice_verifications_gr_id_fkey FOREIGN KEY (gr_id)
    REFERENCES public.goods_receipts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.goods_receipts
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    po_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    gr_number character varying(50) COLLATE pg_catalog."default" NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    received_date date NOT NULL DEFAULT CURRENT_DATE,
    notes text COLLATE pg_catalog."default",
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    invoice_number character varying(100) COLLATE pg_catalog."default",
    invoice_date date,
    journal_id uuid,
    source character varying(20) COLLATE pg_catalog."default" DEFAULT 'SUPPLIER'::character varying,
    CONSTRAINT goods_receipts_pkey PRIMARY KEY (id),
    CONSTRAINT goods_receipts_company_id_gr_number_key UNIQUE (company_id, gr_number)
);

CREATE INDEX IF NOT EXISTS idx_goods_receipts_company
    ON public.goods_receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_po
    ON public.goods_receipts(po_id);

ALTER TABLE IF EXISTS public.goods_receipts
    ADD CONSTRAINT goods_receipts_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_receipts
    ADD CONSTRAINT goods_receipts_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_receipts
    ADD CONSTRAINT goods_receipts_journal_id_fkey FOREIGN KEY (journal_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_receipts
    ADD CONSTRAINT goods_receipts_po_id_fkey FOREIGN KEY (po_id)
    REFERENCES public.purchase_orders (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_receipts
    ADD CONSTRAINT goods_receipts_warehouse_id_fkey FOREIGN KEY (warehouse_id)
    REFERENCES public.warehouses (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.goods_receipt_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    gr_id uuid NOT NULL,
    po_line_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty_received numeric(20, 4) NOT NULL,
    unit_price_invoice numeric(20, 4) NOT NULL,
    total_price_invoice numeric(20, 4) NOT NULL,
    unit_price_po numeric(20, 4) NOT NULL,
    price_variance numeric(20, 4) NOT NULL DEFAULT 0,
    price_variance_pct numeric(8, 4) NOT NULL DEFAULT 0,
    variance_status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'OK'::character varying,
    notes text COLLATE pg_catalog."default",
    qty_rejected numeric(20, 4) DEFAULT 0,
    reject_reason character varying(50) COLLATE pg_catalog."default",
    reject_notes text COLLATE pg_catalog."default",
    qty_invoiced numeric(20, 4) NOT NULL DEFAULT 0,
    qty_po_uom numeric(20, 4) NOT NULL,
    uom_po character varying(30) COLLATE pg_catalog."default" NOT NULL,
    uom_received character varying(30) COLLATE pg_catalog."default" NOT NULL,
    conversion_factor numeric(20, 6) NOT NULL DEFAULT 1,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT goods_receipt_lines_pkey PRIMARY KEY (id)
);

COMMENT ON COLUMN public.goods_receipt_lines.qty_invoiced
    IS 'Qty yang sudah di-cover oleh Purchase Invoice (incremental)';

CREATE INDEX IF NOT EXISTS idx_gr_lines_gr
    ON public.goods_receipt_lines(gr_id);
CREATE INDEX IF NOT EXISTS idx_gr_lines_po_line
    ON public.goods_receipt_lines(po_line_id);

ALTER TABLE IF EXISTS public.goods_receipt_lines
    ADD CONSTRAINT goods_receipt_lines_gr_id_fkey FOREIGN KEY (gr_id)
    REFERENCES public.goods_receipts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.goods_receipt_lines
    ADD CONSTRAINT goods_receipt_lines_po_line_id_fkey FOREIGN KEY (po_line_id)
    REFERENCES public.purchase_order_lines (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.goods_receipt_lines
    ADD CONSTRAINT goods_receipt_lines_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.goods_receipt_attachments
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    gr_id uuid NOT NULL,
    file_type character varying(30) COLLATE pg_catalog."default" NOT NULL,
    file_path text COLLATE pg_catalog."default" NOT NULL,
    file_name character varying(255) COLLATE pg_catalog."default",
    uploaded_at timestamp with time zone DEFAULT now(),
    uploaded_by uuid,
    CONSTRAINT goods_receipt_attachments_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_gr_attachments_gr_id
    ON public.goods_receipt_attachments(gr_id);

ALTER TABLE IF EXISTS public.goods_receipt_attachments
    ADD CONSTRAINT goods_receipt_attachments_gr_id_fkey FOREIGN KEY (gr_id)
    REFERENCES public.goods_receipts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


END;