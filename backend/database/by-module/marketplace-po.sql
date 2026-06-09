-- ============================================
-- Module: marketplace-po
-- Generated: 2026-06-09T16:36:06.345Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_checkout_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    po_id uuid NOT NULL,
    po_line_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty numeric(12, 2) NOT NULL,
    unit_price_netto numeric(15, 2) NOT NULL,
    total_netto numeric(15, 2) NOT NULL,
    platform_order_id character varying(100) COLLATE pg_catalog."default",
    platform_item_id character varying(100) COLLATE pg_catalog."default",
    notes text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT marketplace_checkout_lines_pkey PRIMARY KEY (id),
    CONSTRAINT mpl_po_line_session_key UNIQUE (session_id, po_line_id)
);

COMMENT ON TABLE public.marketplace_checkout_lines
    IS 'Line item dalam satu sesi checkout.';

CREATE INDEX IF NOT EXISTS idx_mcl_branch
    ON public.marketplace_checkout_lines(branch_id);
CREATE INDEX IF NOT EXISTS idx_mcl_po
    ON public.marketplace_checkout_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_mcl_product
    ON public.marketplace_checkout_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_mcl_session
    ON public.marketplace_checkout_lines(session_id);

ALTER TABLE IF EXISTS public.marketplace_checkout_lines
    ADD CONSTRAINT marketplace_checkout_lines_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_checkout_lines
    ADD CONSTRAINT marketplace_checkout_lines_po_id_fkey FOREIGN KEY (po_id)
    REFERENCES public.purchase_orders (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_checkout_lines
    ADD CONSTRAINT marketplace_checkout_lines_po_line_id_fkey FOREIGN KEY (po_line_id)
    REFERENCES public.purchase_order_lines (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_checkout_lines
    ADD CONSTRAINT marketplace_checkout_lines_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_checkout_lines
    ADD CONSTRAINT marketplace_checkout_lines_session_id_fkey FOREIGN KEY (session_id)
    REFERENCES public.marketplace_checkout_sessions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.marketplace_checkout_sessions
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    session_number character varying(50) COLLATE pg_catalog."default" NOT NULL,
    platform character varying(20) COLLATE pg_catalog."default" NOT NULL,
    cc_id uuid NOT NULL,
    checkout_date date NOT NULL DEFAULT CURRENT_DATE,
    total_amount numeric(15, 2) NOT NULL DEFAULT 0,
    notes text COLLATE pg_catalog."default",
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    platform_order_ids text[] COLLATE pg_catalog."default",
    platform_receipt_url text COLLATE pg_catalog."default",
    journal_ordered_id uuid,
    journal_received_id uuid,
    journal_settled_id uuid,
    goods_receipt_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,
    cancel_reason text COLLATE pg_catalog."default",
    platform_cancel_ref character varying(100) COLLATE pg_catalog."default",
    CONSTRAINT marketplace_checkout_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT marketplace_sessions_number_company_key UNIQUE (company_id, session_number)
);

COMMENT ON TABLE public.marketplace_checkout_sessions
    IS 'Satu sesi checkout marketplace. Bisa mencakup beberapa cabang sekaligus. ';

CREATE INDEX IF NOT EXISTS idx_mcs_cc
    ON public.marketplace_checkout_sessions(cc_id);
CREATE INDEX IF NOT EXISTS idx_mcs_company
    ON public.marketplace_checkout_sessions(company_id);

ALTER TABLE IF EXISTS public.marketplace_checkout_sessions
    ADD CONSTRAINT marketplace_checkout_sessions_cc_id_fkey FOREIGN KEY (cc_id)
    REFERENCES public.owner_credit_cards (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_checkout_sessions
    ADD CONSTRAINT marketplace_checkout_sessions_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.marketplace_checkout_sessions
    ADD CONSTRAINT marketplace_checkout_sessions_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_checkout_sessions
    ADD CONSTRAINT marketplace_checkout_sessions_goods_receipt_id_fkey FOREIGN KEY (goods_receipt_id)
    REFERENCES public.goods_receipts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_checkout_sessions
    ADD CONSTRAINT marketplace_checkout_sessions_journal_ordered_id_fkey FOREIGN KEY (journal_ordered_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_checkout_sessions
    ADD CONSTRAINT marketplace_checkout_sessions_journal_received_id_fkey FOREIGN KEY (journal_received_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_checkout_sessions
    ADD CONSTRAINT marketplace_checkout_sessions_journal_settled_id_fkey FOREIGN KEY (journal_settled_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_checkout_sessions
    ADD CONSTRAINT marketplace_checkout_sessions_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.owner_credit_cards
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    card_label character varying(100) COLLATE pg_catalog."default" NOT NULL,
    bank_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    last4 character(4) COLLATE pg_catalog."default",
    coa_code character varying(20) COLLATE pg_catalog."default" NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    settlement_bank_account_id integer,
    CONSTRAINT owner_credit_cards_pkey PRIMARY KEY (id),
    CONSTRAINT owner_credit_cards_company_label_key UNIQUE (company_id, card_label)
);

COMMENT ON TABLE public.owner_credit_cards
    IS 'Master kartu kredit owner yang dipakai untuk checkout marketplace. Setiap kartu dipetakan ke 1 akun COA (sub 210600). settlement_bank_account_id = rekening bank default untuk pelunasan kartu ini.';
COMMENT ON COLUMN public.owner_credit_cards.settlement_bank_account_id
    IS 'Rekening bank default untuk pelunasan (bulk/single settlement). NULL = belum dikonfigurasi.';

CREATE INDEX IF NOT EXISTS idx_owner_cc_company
    ON public.owner_credit_cards(company_id);
CREATE INDEX IF NOT EXISTS idx_owner_cc_settlement_bank
    ON public.owner_credit_cards(settlement_bank_account_id);

ALTER TABLE IF EXISTS public.owner_credit_cards
    ADD CONSTRAINT owner_credit_cards_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.owner_credit_cards
    ADD CONSTRAINT owner_credit_cards_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.owner_credit_cards
    ADD CONSTRAINT owner_credit_cards_settlement_bank_account_id_fkey FOREIGN KEY (settlement_bank_account_id)
    REFERENCES public.bank_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.owner_credit_cards
    ADD CONSTRAINT owner_credit_cards_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.marketplace_settlements
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    session_id uuid,
    settled_date date NOT NULL DEFAULT CURRENT_DATE,
    bank_account_id integer,
    amount numeric(15, 2) NOT NULL,
    reference_number character varying(100) COLLATE pg_catalog."default",
    notes text COLLATE pg_catalog."default",
    journal_id uuid,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    general_invoice_payment_id uuid,
    CONSTRAINT marketplace_settlements_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_mkt_settlements_gen_inv_pay
    ON public.marketplace_settlements(general_invoice_payment_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_settlements_journal_id
    ON public.marketplace_settlements(journal_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_settlements_session_id
    ON public.marketplace_settlements(session_id);

ALTER TABLE IF EXISTS public.marketplace_settlements
    ADD CONSTRAINT marketplace_settlements_bank_account_id_fkey FOREIGN KEY (bank_account_id)
    REFERENCES public.bank_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_settlements
    ADD CONSTRAINT marketplace_settlements_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_settlements
    ADD CONSTRAINT marketplace_settlements_general_invoice_payment_id_fkey FOREIGN KEY (general_invoice_payment_id)
    REFERENCES public.general_invoice_payments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_settlements
    ADD CONSTRAINT marketplace_settlements_journal_id_fkey FOREIGN KEY (journal_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_settlements
    ADD CONSTRAINT marketplace_settlements_session_id_fkey FOREIGN KEY (session_id)
    REFERENCES public.marketplace_checkout_sessions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.marketplace_checkout_attachments
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    file_type character varying(30) COLLATE pg_catalog."default" NOT NULL,
    file_path text COLLATE pg_catalog."default" NOT NULL,
    file_name character varying(255) COLLATE pg_catalog."default",
    file_size bigint,
    uploaded_by uuid,
    uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT marketplace_checkout_attachments_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.marketplace_checkout_attachments
    IS 'Dokumen pendukung checkout marketplace.';

CREATE INDEX IF NOT EXISTS idx_mca_session
    ON public.marketplace_checkout_attachments(session_id);

ALTER TABLE IF EXISTS public.marketplace_checkout_attachments
    ADD CONSTRAINT marketplace_checkout_attachments_session_id_fkey FOREIGN KEY (session_id)
    REFERENCES public.marketplace_checkout_sessions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.marketplace_checkout_attachments
    ADD CONSTRAINT marketplace_checkout_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.marketplace_shipments
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    tracking_number character varying(100) COLLATE pg_catalog."default",
    courier character varying(50) COLLATE pg_catalog."default",
    shipped_at timestamp with time zone,
    received_at timestamp with time zone,
    notes text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT marketplace_shipments_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_ms_branch
    ON public.marketplace_shipments(branch_id);
CREATE INDEX IF NOT EXISTS idx_ms_session
    ON public.marketplace_shipments(session_id);

ALTER TABLE IF EXISTS public.marketplace_shipments
    ADD CONSTRAINT marketplace_shipments_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.marketplace_shipments
    ADD CONSTRAINT marketplace_shipments_session_id_fkey FOREIGN KEY (session_id)
    REFERENCES public.marketplace_checkout_sessions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


END;