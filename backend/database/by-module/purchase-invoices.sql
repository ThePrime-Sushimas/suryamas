-- ============================================
-- Module: purchase-invoices
-- Generated: 2026-06-09T16:36:06.347Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.purchase_invoice_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    purchase_invoice_id uuid NOT NULL,
    gr_line_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty_received numeric(20, 4) NOT NULL,
    qty_invoiced numeric(20, 4) NOT NULL,
    unit_price numeric(20, 4) NOT NULL DEFAULT 0,
    subtotal numeric(20, 4) NOT NULL DEFAULT 0,
    tax_rate numeric(5, 2) NOT NULL DEFAULT 0,
    tax_amount numeric(20, 4) NOT NULL DEFAULT 0,
    total numeric(20, 4) NOT NULL DEFAULT 0,
    qty_po numeric(20, 4),
    unit_price_po numeric(20, 4),
    variance_qty numeric(20, 4) NOT NULL DEFAULT 0,
    variance_price numeric(20, 4) NOT NULL DEFAULT 0,
    match_status character varying(10) COLLATE pg_catalog."default" NOT NULL DEFAULT 'MATCH'::character varying,
    sort_order integer NOT NULL DEFAULT 0,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT purchase_invoice_lines_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_pi_lines_gr_line
    ON public.purchase_invoice_lines(gr_line_id);
CREATE INDEX IF NOT EXISTS idx_pi_lines_invoice
    ON public.purchase_invoice_lines(purchase_invoice_id);

ALTER TABLE IF EXISTS public.purchase_invoice_lines
    ADD CONSTRAINT purchase_invoice_lines_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoice_lines
    ADD CONSTRAINT purchase_invoice_lines_gr_line_id_fkey FOREIGN KEY (gr_line_id)
    REFERENCES public.goods_receipt_lines (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoice_lines
    ADD CONSTRAINT purchase_invoice_lines_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoice_lines
    ADD CONSTRAINT purchase_invoice_lines_purchase_invoice_id_fkey FOREIGN KEY (purchase_invoice_id)
    REFERENCES public.purchase_invoices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.purchase_invoice_lines
    ADD CONSTRAINT purchase_invoice_lines_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.purchase_invoices
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    invoice_number character varying(100) COLLATE pg_catalog."default" NOT NULL,
    invoice_date date NOT NULL,
    due_date date,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    notes text COLLATE pg_catalog."default",
    rejection_reason text COLLATE pg_catalog."default",
    subtotal numeric(20, 4) NOT NULL DEFAULT 0,
    total_tax numeric(20, 4) NOT NULL DEFAULT 0,
    total_amount numeric(20, 4) NOT NULL DEFAULT 0,
    submitted_by uuid,
    submitted_at timestamp with time zone,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejected_by uuid,
    rejected_at timestamp with time zone,
    posted_by uuid,
    posted_at timestamp with time zone,
    journal_id uuid,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    total_charges numeric(20, 4) NOT NULL DEFAULT 0,
    merged_from_invoice_ids uuid[] DEFAULT '{}'::uuid[],
    assigned_bank_account_id integer,
    assigned_bank_account_by uuid,
    assigned_bank_account_at timestamp with time zone,
    supplier_bank_account_id integer,
    supplier_bank_account_by uuid,
    supplier_bank_account_at timestamp with time zone,
    CONSTRAINT purchase_invoices_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_invoices_company_id_supplier_id_invoice_number_key UNIQUE (company_id, supplier_id, invoice_number)
);

COMMENT ON COLUMN public.purchase_invoices.total_charges
    IS 'Sum of purchase_invoice_charges.total (incl. tax on charges);

CREATE INDEX IF NOT EXISTS idx_pi_assigned_bank_account
    ON public.purchase_invoices(assigned_bank_account_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_branch
    ON public.purchase_invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company
    ON public.purchase_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_pi_supplier_bank_account
    ON public.purchase_invoices(supplier_bank_account_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier
    ON public.purchase_invoices(supplier_id);

ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_approved_by_fkey FOREIGN KEY (approved_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_assigned_bank_account_by_fkey FOREIGN KEY (assigned_bank_account_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_assigned_bank_account_id_fkey FOREIGN KEY (assigned_bank_account_id)
    REFERENCES public.bank_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_journal_id_fkey FOREIGN KEY (journal_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_posted_by_fkey FOREIGN KEY (posted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_rejected_by_fkey FOREIGN KEY (rejected_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_submitted_by_fkey FOREIGN KEY (submitted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_supplier_bank_account_by_fkey FOREIGN KEY (supplier_bank_account_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_supplier_bank_account_id_fkey FOREIGN KEY (supplier_bank_account_id)
    REFERENCES public.bank_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_supplier_id_fkey FOREIGN KEY (supplier_id)
    REFERENCES public.suppliers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.purchase_invoice_gr_links
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    purchase_invoice_id uuid NOT NULL,
    goods_receipt_id uuid NOT NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT purchase_invoice_gr_links_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_invoice_gr_links_purchase_invoice_id_goods_receipt_key UNIQUE (purchase_invoice_id, goods_receipt_id)
);

CREATE INDEX IF NOT EXISTS idx_pi_gr_links_gr
    ON public.purchase_invoice_gr_links(goods_receipt_id);
CREATE INDEX IF NOT EXISTS idx_pi_gr_links_invoice
    ON public.purchase_invoice_gr_links(purchase_invoice_id);

ALTER TABLE IF EXISTS public.purchase_invoice_gr_links
    ADD CONSTRAINT purchase_invoice_gr_links_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoice_gr_links
    ADD CONSTRAINT purchase_invoice_gr_links_goods_receipt_id_fkey FOREIGN KEY (goods_receipt_id)
    REFERENCES public.goods_receipts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoice_gr_links
    ADD CONSTRAINT purchase_invoice_gr_links_purchase_invoice_id_fkey FOREIGN KEY (purchase_invoice_id)
    REFERENCES public.purchase_invoices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.purchase_invoice_gr_links
    ADD CONSTRAINT purchase_invoice_gr_links_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.purchase_invoice_attachments
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    purchase_invoice_id uuid NOT NULL,
    file_path text COLLATE pg_catalog."default" NOT NULL,
    file_name text COLLATE pg_catalog."default",
    file_type text COLLATE pg_catalog."default",
    file_size integer,
    uploaded_at timestamp with time zone DEFAULT now(),
    uploaded_by uuid,
    CONSTRAINT purchase_invoice_attachments_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_pi_attachments_invoice
    ON public.purchase_invoice_attachments(purchase_invoice_id);

ALTER TABLE IF EXISTS public.purchase_invoice_attachments
    ADD CONSTRAINT purchase_invoice_attachments_purchase_invoice_id_fkey FOREIGN KEY (purchase_invoice_id)
    REFERENCES public.purchase_invoices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.purchase_invoice_charges
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    purchase_invoice_id uuid NOT NULL,
    charge_type character varying(20) COLLATE pg_catalog."default" NOT NULL,
    description character varying(255) COLLATE pg_catalog."default",
    amount numeric(20, 4) NOT NULL,
    tax_rate numeric(5, 2) NOT NULL DEFAULT 0,
    tax_amount numeric(20, 4) NOT NULL DEFAULT 0,
    total numeric(20, 4) NOT NULL DEFAULT 0,
    sort_order integer NOT NULL DEFAULT 0,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    affects_dpp boolean NOT NULL DEFAULT false,
    CONSTRAINT purchase_invoice_charges_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.purchase_invoice_charges
    IS 'Non-GR invoice adjustments: discount (negative amount), shipping, fees;
COMMENT ON COLUMN public.purchase_invoice_charges.amount
    IS 'Pre-tax amount;
COMMENT ON COLUMN public.purchase_invoice_charges.total
    IS 'amount + tax_amount (same sign as net effect on AP).';
COMMENT ON COLUMN public.purchase_invoice_charges.affects_dpp
    IS 'True only for DISCOUNT: reduces aggregate goods DPP before VAT;

CREATE INDEX IF NOT EXISTS idx_pi_charges_invoice
    ON public.purchase_invoice_charges(purchase_invoice_id);

ALTER TABLE IF EXISTS public.purchase_invoice_charges
    ADD CONSTRAINT purchase_invoice_charges_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.purchase_invoice_charges
    ADD CONSTRAINT purchase_invoice_charges_purchase_invoice_id_fkey FOREIGN KEY (purchase_invoice_id)
    REFERENCES public.purchase_invoices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.purchase_invoice_charges
    ADD CONSTRAINT purchase_invoice_charges_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;