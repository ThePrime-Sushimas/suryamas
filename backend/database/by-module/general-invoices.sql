-- ============================================
-- Module: general-invoices
-- Generated: 2026-06-09T16:36:06.347Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.general_invoice_payments
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    payment_number text COLLATE pg_catalog."default" NOT NULL,
    general_invoice_id uuid NOT NULL,
    bank_account_id integer,
    payment_method text COLLATE pg_catalog."default" NOT NULL DEFAULT 'TRANSFER'::text,
    total_amount numeric(20, 4) NOT NULL,
    payment_date date,
    notes text COLLATE pg_catalog."default",
    proof_url text COLLATE pg_catalog."default",
    proof_uploaded_at timestamp with time zone,
    proof_uploaded_by uuid,
    status text COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::text,
    rejection_reason text COLLATE pg_catalog."default",
    requested_by uuid,
    requested_at timestamp with time zone,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejected_by uuid,
    rejected_at timestamp with time zone,
    paid_by uuid,
    paid_at timestamp with time zone,
    journal_id uuid,
    bank_statement_id bigint,
    reconciled_at timestamp with time zone,
    reconciled_by uuid,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    owner_credit_card_id uuid,
    cc_settlement_id uuid,
    CONSTRAINT gen_inv_payments_pkey PRIMARY KEY (id),
    CONSTRAINT gen_inv_payments_company_number_key UNIQUE (company_id, payment_number)
);

CREATE INDEX IF NOT EXISTS idx_gen_pay_branch
    ON public.general_invoice_payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_gen_pay_company
    ON public.general_invoice_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_gen_pay_invoice
    ON public.general_invoice_payments(general_invoice_id);
CREATE INDEX IF NOT EXISTS idx_gen_pay_cc_settlement
    ON public.general_invoice_payments(cc_settlement_id);
CREATE INDEX IF NOT EXISTS idx_gen_pay_cc_owner
    ON public.general_invoice_payments(owner_credit_card_id);

ALTER TABLE IF EXISTS public.general_invoice_payments
    ADD CONSTRAINT gen_inv_payments_approved_by_fkey FOREIGN KEY (approved_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_payments
    ADD CONSTRAINT gen_inv_payments_bank_account_fkey FOREIGN KEY (bank_account_id)
    REFERENCES public.bank_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_payments
    ADD CONSTRAINT gen_inv_payments_bank_stmt_fkey FOREIGN KEY (bank_statement_id)
    REFERENCES public.bank_statements (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_payments
    ADD CONSTRAINT gen_inv_payments_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_payments
    ADD CONSTRAINT gen_inv_payments_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.general_invoice_payments
    ADD CONSTRAINT gen_inv_payments_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_payments
    ADD CONSTRAINT gen_inv_payments_invoice_fkey FOREIGN KEY (general_invoice_id)
    REFERENCES public.general_invoices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_payments
    ADD CONSTRAINT gen_inv_payments_journal_fkey FOREIGN KEY (journal_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_payments
    ADD CONSTRAINT gen_inv_payments_paid_by_fkey FOREIGN KEY (paid_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_payments
    ADD CONSTRAINT general_invoice_payments_cc_settlement_id_fkey FOREIGN KEY (cc_settlement_id)
    REFERENCES public.marketplace_settlements (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_payments
    ADD CONSTRAINT general_invoice_payments_owner_credit_card_id_fkey FOREIGN KEY (owner_credit_card_id)
    REFERENCES public.owner_credit_cards (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.general_invoices
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    invoice_number character varying(100) COLLATE pg_catalog."default" NOT NULL,
    vendor_id uuid NOT NULL,
    invoice_date date NOT NULL,
    due_date date,
    period_start date,
    period_end date,
    is_confidential boolean NOT NULL DEFAULT false,
    subtotal numeric(20, 4) NOT NULL DEFAULT 0,
    total_tax numeric(20, 4) NOT NULL DEFAULT 0,
    total_amount numeric(20, 4) NOT NULL DEFAULT 0,
    notes text COLLATE pg_catalog."default",
    attachment_url text COLLATE pg_catalog."default",
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    journal_id uuid,
    template_id uuid,
    posted_by uuid,
    posted_at timestamp with time zone,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    CONSTRAINT general_invoices_pkey PRIMARY KEY (id),
    CONSTRAINT general_invoices_company_number_key UNIQUE (company_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_gen_inv_branch
    ON public.general_invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_gen_inv_company
    ON public.general_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_gen_inv_vendor
    ON public.general_invoices(vendor_id);

ALTER TABLE IF EXISTS public.general_invoices
    ADD CONSTRAINT general_invoices_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoices
    ADD CONSTRAINT general_invoices_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.general_invoices
    ADD CONSTRAINT general_invoices_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoices
    ADD CONSTRAINT general_invoices_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoices
    ADD CONSTRAINT general_invoices_journal_id_fkey FOREIGN KEY (journal_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoices
    ADD CONSTRAINT general_invoices_posted_by_fkey FOREIGN KEY (posted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoices
    ADD CONSTRAINT general_invoices_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoices
    ADD CONSTRAINT general_invoices_vendor_id_fkey FOREIGN KEY (vendor_id)
    REFERENCES public.vendors (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.vendors
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    vendor_code character varying(30) COLLATE pg_catalog."default" NOT NULL,
    vendor_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    vendor_type character varying(50) COLLATE pg_catalog."default",
    phone character varying(30) COLLATE pg_catalog."default",
    email character varying(150) COLLATE pg_catalog."default",
    address text COLLATE pg_catalog."default",
    bank_name character varying(100) COLLATE pg_catalog."default",
    bank_account_number character varying(50) COLLATE pg_catalog."default",
    bank_account_name character varying(150) COLLATE pg_catalog."default",
    notes text COLLATE pg_catalog."default",
    is_active boolean NOT NULL DEFAULT true,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    contact_person character varying(150) COLLATE pg_catalog."default",
    CONSTRAINT vendors_pkey PRIMARY KEY (id),
    CONSTRAINT vendors_company_code_key UNIQUE (company_id, vendor_code)
);

COMMENT ON COLUMN public.vendors.contact_person
    IS 'PIC / Contact Person for this vendor';

CREATE INDEX IF NOT EXISTS idx_vendors_company
    ON public.vendors(company_id);

ALTER TABLE IF EXISTS public.vendors
    ADD CONSTRAINT vendors_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.vendors
    ADD CONSTRAINT vendors_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.vendors
    ADD CONSTRAINT vendors_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.vendors
    ADD CONSTRAINT vendors_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.general_invoice_templates
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    template_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    vendor_id uuid NOT NULL,
    is_confidential boolean NOT NULL DEFAULT false,
    recurrence character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'MONTHLY'::character varying,
    default_amount numeric(20, 4),
    due_date_offset_days integer NOT NULL DEFAULT 14,
    notes text COLLATE pg_catalog."default",
    is_active boolean NOT NULL DEFAULT true,
    last_generated_at date,
    preferred_vendor_bank_account_id integer,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT gen_inv_templates_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_gen_tmpl_company
    ON public.general_invoice_templates(company_id);

ALTER TABLE IF EXISTS public.general_invoice_templates
    ADD CONSTRAINT gen_inv_templates_branch_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_templates
    ADD CONSTRAINT gen_inv_templates_company_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.general_invoice_templates
    ADD CONSTRAINT gen_inv_templates_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_templates
    ADD CONSTRAINT gen_inv_templates_vendor_fkey FOREIGN KEY (vendor_id)
    REFERENCES public.vendors (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_templates
    ADD CONSTRAINT gen_inv_templates_preferred_bank_fkey FOREIGN KEY (preferred_vendor_bank_account_id)
    REFERENCES public.bank_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

COMMENT ON COLUMN public.general_invoice_templates.preferred_vendor_bank_account_id
    IS 'Preferred vendor bank account to use when generating invoice. Null = use vendor default.';

CREATE TABLE IF NOT EXISTS public.general_invoice_template_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL,
    line_number integer NOT NULL,
    account_id uuid NOT NULL,
    description character varying(500) COLLATE pg_catalog."default",
    amount_ratio numeric(5, 4),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    transaction_type character varying(10) COLLATE pg_catalog."default" NOT NULL DEFAULT 'EXPENSE'::character varying,
    expense_account_id uuid,
    total_periods integer,
    amortization_start_offset_days integer,
    tax_account_id uuid,
    CONSTRAINT gen_tmpl_lines_pkey PRIMARY KEY (id),
    CONSTRAINT gen_tmpl_lines_unique UNIQUE (template_id, line_number)
);

COMMENT ON COLUMN public.general_invoice_template_lines.tax_account_id
    IS 'Optional default COA for tax when generating invoices from this template.';

CREATE INDEX IF NOT EXISTS idx_gen_tmpl_lines_template
    ON public.general_invoice_template_lines(template_id);

ALTER TABLE IF EXISTS public.general_invoice_template_lines
    ADD CONSTRAINT gen_tmpl_lines_account_fkey FOREIGN KEY (account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_template_lines
    ADD CONSTRAINT gen_tmpl_lines_expense_account_fkey FOREIGN KEY (expense_account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_template_lines
    ADD CONSTRAINT gen_tmpl_lines_template_fkey FOREIGN KEY (template_id)
    REFERENCES public.general_invoice_templates (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.general_invoice_template_lines
    ADD CONSTRAINT general_invoice_template_lines_tax_account_id_fkey FOREIGN KEY (tax_account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.general_invoice_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    general_invoice_id uuid NOT NULL,
    line_number integer NOT NULL,
    account_id uuid NOT NULL,
    description character varying(500) COLLATE pg_catalog."default",
    amount numeric(20, 4) NOT NULL DEFAULT 0,
    tax_amount numeric(20, 4) NOT NULL DEFAULT 0,
    total_amount numeric(20, 4) NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    transaction_type character varying(10) COLLATE pg_catalog."default" NOT NULL DEFAULT 'EXPENSE'::character varying,
    expense_account_id uuid,
    total_periods integer,
    amortization_start_date date,
    tax_account_id uuid,
    CONSTRAINT general_invoice_lines_pkey PRIMARY KEY (id),
    CONSTRAINT gen_inv_lines_unique_line UNIQUE (general_invoice_id, line_number)
);

COMMENT ON COLUMN public.general_invoice_lines.tax_account_id
    IS 'Optional COA for tax (e.g. PPN Masukan 1xxx). If NULL, tax is included in the main account debit.';

CREATE INDEX IF NOT EXISTS idx_gen_inv_lines_account
    ON public.general_invoice_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_gen_inv_lines_invoice
    ON public.general_invoice_lines(general_invoice_id);

ALTER TABLE IF EXISTS public.general_invoice_lines
    ADD CONSTRAINT gen_inv_lines_account_fkey FOREIGN KEY (account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_lines
    ADD CONSTRAINT gen_inv_lines_expense_account_fkey FOREIGN KEY (expense_account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_lines
    ADD CONSTRAINT gen_inv_lines_invoice_fkey FOREIGN KEY (general_invoice_id)
    REFERENCES public.general_invoices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.general_invoice_lines
    ADD CONSTRAINT general_invoice_lines_tax_account_id_fkey FOREIGN KEY (tax_account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.general_invoice_amortizations
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    invoice_line_id uuid NOT NULL,
    total_amount numeric(20, 4) NOT NULL,
    total_periods integer NOT NULL,
    amount_per_period numeric(20, 4) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    prepaid_account_id uuid NOT NULL,
    expense_account_id uuid NOT NULL,
    periods_executed integer NOT NULL DEFAULT 0,
    last_executed_at date,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'ACTIVE'::character varying,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    CONSTRAINT gen_inv_amort_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_gen_amort_company
    ON public.general_invoice_amortizations(company_id);
CREATE INDEX IF NOT EXISTS idx_gen_amort_invoice
    ON public.general_invoice_amortizations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_gen_amort_line
    ON public.general_invoice_amortizations(invoice_line_id);

ALTER TABLE IF EXISTS public.general_invoice_amortizations
    ADD CONSTRAINT gen_inv_amort_branch_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_amortizations
    ADD CONSTRAINT gen_inv_amort_company_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.general_invoice_amortizations
    ADD CONSTRAINT gen_inv_amort_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_amortizations
    ADD CONSTRAINT gen_inv_amort_expense_fkey FOREIGN KEY (expense_account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_amortizations
    ADD CONSTRAINT gen_inv_amort_invoice_fkey FOREIGN KEY (invoice_id)
    REFERENCES public.general_invoices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_amortizations
    ADD CONSTRAINT gen_inv_amort_line_fkey FOREIGN KEY (invoice_line_id)
    REFERENCES public.general_invoice_lines (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_amortizations
    ADD CONSTRAINT gen_inv_amort_prepaid_fkey FOREIGN KEY (prepaid_account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.general_invoice_amortization_entries
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    amortization_id uuid NOT NULL,
    period_number integer NOT NULL,
    period_date date NOT NULL,
    amount numeric(20, 4) NOT NULL,
    journal_id uuid,
    executed_at timestamp with time zone,
    executed_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT gen_inv_amort_entries_pkey PRIMARY KEY (id),
    CONSTRAINT gen_inv_amort_entries_unique UNIQUE (amortization_id, period_number)
);

CREATE INDEX IF NOT EXISTS idx_gen_amort_entries_amort
    ON public.general_invoice_amortization_entries(amortization_id);

ALTER TABLE IF EXISTS public.general_invoice_amortization_entries
    ADD CONSTRAINT gen_inv_amort_entries_amort_fkey FOREIGN KEY (amortization_id)
    REFERENCES public.general_invoice_amortizations (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.general_invoice_amortization_entries
    ADD CONSTRAINT gen_inv_amort_entries_executed_by_fkey FOREIGN KEY (executed_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.general_invoice_amortization_entries
    ADD CONSTRAINT gen_inv_amort_entries_journal_fkey FOREIGN KEY (journal_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;