-- ============================================
-- Module: ap-payments
-- Generated: 2026-06-09T16:36:06.342Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ap_payments
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    payment_number text COLLATE pg_catalog."default" NOT NULL,
    supplier_id uuid NOT NULL,
    bank_account_id integer NOT NULL,
    payment_method text COLLATE pg_catalog."default" NOT NULL,
    total_amount numeric(20, 4) NOT NULL,
    payment_date date,
    notes text COLLATE pg_catalog."default",
    rejection_reason text COLLATE pg_catalog."default",
    status text COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::text,
    proof_url text COLLATE pg_catalog."default",
    proof_uploaded_at timestamp with time zone,
    proof_uploaded_by uuid,
    requested_by uuid,
    requested_at timestamp with time zone,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejected_by uuid,
    rejected_at timestamp with time zone,
    paid_by uuid,
    paid_at timestamp with time zone,
    bank_statement_id bigint,
    journal_id uuid,
    reconciled_at timestamp with time zone,
    reconciled_by uuid,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    bulk_payment_batch_id uuid,
    supplier_bank_account_id integer,
    CONSTRAINT ap_payments_pkey PRIMARY KEY (id),
    CONSTRAINT ap_payments_company_id_payment_number_key UNIQUE (company_id, payment_number)
);

CREATE INDEX IF NOT EXISTS idx_ap_payments_bank_stmt
    ON public.ap_payments(bank_statement_id);
CREATE INDEX IF NOT EXISTS idx_ap_payments_branch
    ON public.ap_payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_ap_payments_bulk_batch
    ON public.ap_payments(bulk_payment_batch_id);
CREATE INDEX IF NOT EXISTS idx_ap_payments_company
    ON public.ap_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_ap_payments_supplier_bank
    ON public.ap_payments(supplier_bank_account_id);
CREATE INDEX IF NOT EXISTS idx_ap_payments_supplier
    ON public.ap_payments(supplier_id);

ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_approved_by_fkey FOREIGN KEY (approved_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_bank_account_id_fkey FOREIGN KEY (bank_account_id)
    REFERENCES public.bank_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_bank_statement_id_fkey FOREIGN KEY (bank_statement_id)
    REFERENCES public.bank_statements (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_bulk_payment_batch_id_fkey FOREIGN KEY (bulk_payment_batch_id)
    REFERENCES public.ap_payment_batches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_journal_id_fkey FOREIGN KEY (journal_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_paid_by_fkey FOREIGN KEY (paid_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_proof_uploaded_by_fkey FOREIGN KEY (proof_uploaded_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_reconciled_by_fkey FOREIGN KEY (reconciled_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_rejected_by_fkey FOREIGN KEY (rejected_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_requested_by_fkey FOREIGN KEY (requested_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_supplier_bank_account_id_fkey FOREIGN KEY (supplier_bank_account_id)
    REFERENCES public.bank_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_supplier_id_fkey FOREIGN KEY (supplier_id)
    REFERENCES public.suppliers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.ap_payments
    ADD CONSTRAINT ap_payments_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.ap_payment_batches
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    total_payments integer NOT NULL,
    total_amount numeric(15, 2) NOT NULL,
    notes text COLLATE pg_catalog."default",
    CONSTRAINT ap_payment_batches_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_ap_payment_batches_created_by
    ON public.ap_payment_batches(created_by);

ALTER TABLE IF EXISTS public.ap_payment_batches
    ADD CONSTRAINT ap_payment_batches_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.ap_payment_invoice_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    ap_payment_id uuid NOT NULL,
    purchase_invoice_id uuid NOT NULL,
    amount_paid numeric(20, 4) NOT NULL,
    notes text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT ap_payment_invoice_lines_pkey PRIMARY KEY (id),
    CONSTRAINT ap_payment_invoice_lines_ap_payment_id_purchase_invoice_id_key UNIQUE (ap_payment_id, purchase_invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_ap_payment_lines_payment
    ON public.ap_payment_invoice_lines(ap_payment_id);
CREATE INDEX IF NOT EXISTS idx_ap_payment_lines_invoice
    ON public.ap_payment_invoice_lines(purchase_invoice_id);

ALTER TABLE IF EXISTS public.ap_payment_invoice_lines
    ADD CONSTRAINT ap_payment_invoice_lines_ap_payment_id_fkey FOREIGN KEY (ap_payment_id)
    REFERENCES public.ap_payments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.ap_payment_invoice_lines
    ADD CONSTRAINT ap_payment_invoice_lines_purchase_invoice_id_fkey FOREIGN KEY (purchase_invoice_id)
    REFERENCES public.purchase_invoices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;