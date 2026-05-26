-- ============================================================
-- GENERAL AP MODULE
-- Tables: vendors, general_invoices, general_invoice_lines,
--         general_invoice_payments, general_invoice_templates
-- ============================================================

-- ------------------------------------------------------------
-- 1. VENDORS
-- Simpel — tidak ada payment_terms / pricelist seperti suppliers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendors (
    id              uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id      uuid NOT NULL,
    vendor_code     varchar(30)  NOT NULL,
    vendor_name     varchar(255) NOT NULL,
    vendor_type     varchar(50),          -- 'UTILITY','RENT','SERVICE','OTHER'
    phone           varchar(30),
    email           varchar(150),
    address         text,
    bank_name       varchar(100),
    bank_account_number varchar(50),
    bank_account_name   varchar(150),
    notes           text,
    is_active       boolean NOT NULL DEFAULT true,
    is_deleted      boolean NOT NULL DEFAULT false,
    deleted_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid,
    updated_by      uuid,
    deleted_by      uuid,
    CONSTRAINT vendors_pkey PRIMARY KEY (id),
    CONSTRAINT vendors_company_code_key UNIQUE (company_id, vendor_code),
    CONSTRAINT vendors_company_id_fkey FOREIGN KEY (company_id)
        REFERENCES public.companies (id) ON DELETE CASCADE,
    CONSTRAINT vendors_created_by_fkey FOREIGN KEY (created_by)
        REFERENCES public.auth_users (id) ON DELETE SET NULL,
    CONSTRAINT vendors_updated_by_fkey FOREIGN KEY (updated_by)
        REFERENCES public.auth_users (id) ON DELETE SET NULL,
    CONSTRAINT vendors_deleted_by_fkey FOREIGN KEY (deleted_by)
        REFERENCES public.auth_users (id) ON DELETE SET NULL,
    CONSTRAINT vendors_vendor_type_check CHECK (
        vendor_type IS NULL OR vendor_type = ANY (
            ARRAY['UTILITY','RENT','SERVICE','SUBSCRIPTION','OTHER']
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_vendors_company
    ON public.vendors (company_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_vendors_type
    ON public.vendors (vendor_type) WHERE is_deleted = false;

CREATE OR REPLACE TRIGGER vendors_updated_at
    BEFORE UPDATE ON public.vendors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 2. GENERAL INVOICES (header)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.general_invoices (
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id          uuid NOT NULL,
    branch_id           uuid NOT NULL,
    invoice_number      varchar(100) NOT NULL,

    -- vendor (General AP) bukan supplier (inventory)
    vendor_id           uuid NOT NULL,

    invoice_date        date NOT NULL,
    due_date            date,
    period_start        date,          -- untuk tagihan bulanan (listrik Jan 2025)
    period_end          date,

    -- Klasifikasi
    expense_type        varchar(50) NOT NULL,
    -- 'UTILITY','RENT','SALARY_SUPPORT','SUBSCRIPTION','MAINTENANCE','OTHER'

    -- Confidential flag — sewa dll yang hanya boleh dilihat role tertentu
    is_confidential     boolean NOT NULL DEFAULT false,

    subtotal            numeric(20,4) NOT NULL DEFAULT 0,
    total_tax           numeric(20,4) NOT NULL DEFAULT 0,
    total_amount        numeric(20,4) NOT NULL DEFAULT 0,

    notes               text,
    attachment_url      text,

    -- Status: DRAFT → POSTED (no approval by default)
    status              varchar(20) NOT NULL DEFAULT 'DRAFT',

    -- Journal saat POSTED
    journal_id          uuid,

    -- Recurring: link ke template asal
    template_id         uuid,

    -- Audit trail posting
    posted_by           uuid,
    posted_at           timestamptz,

    is_deleted          boolean NOT NULL DEFAULT false,
    deleted_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid,
    updated_by          uuid,
    deleted_by          uuid,

    CONSTRAINT general_invoices_pkey PRIMARY KEY (id),
    CONSTRAINT general_invoices_company_number_key
        UNIQUE (company_id, invoice_number),
    CONSTRAINT general_invoices_company_id_fkey FOREIGN KEY (company_id)
        REFERENCES public.companies (id) ON DELETE CASCADE,
    CONSTRAINT general_invoices_branch_id_fkey FOREIGN KEY (branch_id)
        REFERENCES public.branches (id),
    CONSTRAINT general_invoices_vendor_id_fkey FOREIGN KEY (vendor_id)
        REFERENCES public.vendors (id),
    CONSTRAINT general_invoices_journal_id_fkey FOREIGN KEY (journal_id)
        REFERENCES public.journal_headers (id),
    CONSTRAINT general_invoices_posted_by_fkey FOREIGN KEY (posted_by)
        REFERENCES public.auth_users (id),
    CONSTRAINT general_invoices_created_by_fkey FOREIGN KEY (created_by)
        REFERENCES public.auth_users (id),
    CONSTRAINT general_invoices_updated_by_fkey FOREIGN KEY (updated_by)
        REFERENCES public.auth_users (id),
    CONSTRAINT general_invoices_deleted_by_fkey FOREIGN KEY (deleted_by)
        REFERENCES public.auth_users (id),
    CONSTRAINT general_invoices_status_check CHECK (
        status = ANY (ARRAY['DRAFT','POSTED','CANCELLED'])
    ),
    CONSTRAINT general_invoices_expense_type_check CHECK (
        expense_type = ANY (
            ARRAY['UTILITY','RENT','SALARY_SUPPORT','SUBSCRIPTION','MAINTENANCE','OTHER']
        )
    ),
    CONSTRAINT general_invoices_total_amount_check CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_gen_inv_company
    ON public.general_invoices (company_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_gen_inv_branch
    ON public.general_invoices (branch_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_gen_inv_vendor
    ON public.general_invoices (vendor_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_gen_inv_status
    ON public.general_invoices (status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_gen_inv_due_date
    ON public.general_invoices (due_date) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_gen_inv_confidential
    ON public.general_invoices (is_confidential) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_gen_inv_template
    ON public.general_invoices (template_id) WHERE template_id IS NOT NULL;

CREATE OR REPLACE TRIGGER general_invoices_updated_at
    BEFORE UPDATE ON public.general_invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 3. GENERAL INVOICE LINES
-- Multi-line per invoice, masing-masing bisa punya COA berbeda
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.general_invoice_lines (
    id              uuid NOT NULL DEFAULT gen_random_uuid(),
    general_invoice_id uuid NOT NULL,
    line_number     integer NOT NULL,
    account_id      uuid NOT NULL,       -- FK ke chart_of_accounts
    description     varchar(500),
    amount          numeric(20,4) NOT NULL DEFAULT 0,
    tax_amount      numeric(20,4) NOT NULL DEFAULT 0,
    total_amount    numeric(20,4) NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT general_invoice_lines_pkey PRIMARY KEY (id),
    CONSTRAINT gen_inv_lines_invoice_fkey FOREIGN KEY (general_invoice_id)
        REFERENCES public.general_invoices (id) ON DELETE CASCADE,
    CONSTRAINT gen_inv_lines_account_fkey FOREIGN KEY (account_id)
        REFERENCES public.chart_of_accounts (id),
    CONSTRAINT gen_inv_lines_amount_check CHECK (amount >= 0),
    CONSTRAINT gen_inv_lines_unique_line UNIQUE (general_invoice_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_gen_inv_lines_invoice
    ON public.general_invoice_lines (general_invoice_id);
CREATE INDEX IF NOT EXISTS idx_gen_inv_lines_account
    ON public.general_invoice_lines (account_id);

CREATE OR REPLACE TRIGGER general_invoice_lines_updated_at
    BEFORE UPDATE ON public.general_invoice_lines
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 4. GENERAL INVOICE PAYMENTS
-- Terpisah dari ap_payments (Opsi A)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.general_invoice_payments (
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id          uuid NOT NULL,
    branch_id           uuid NOT NULL,
    payment_number      text NOT NULL,
    general_invoice_id  uuid NOT NULL,
    bank_account_id     integer NOT NULL,
    payment_method      text NOT NULL DEFAULT 'TRANSFER',
    total_amount        numeric(20,4) NOT NULL,
    payment_date        date,
    notes               text,
    proof_url           text,
    proof_uploaded_at   timestamptz,
    proof_uploaded_by   uuid,

    -- Status: DRAFT → APPROVED → PAID
    status              text NOT NULL DEFAULT 'DRAFT',
    rejection_reason    text,

    requested_by        uuid,
    requested_at        timestamptz,
    approved_by         uuid,
    approved_at         timestamptz,
    rejected_by         uuid,
    rejected_at         timestamptz,
    paid_by             uuid,
    paid_at             timestamptz,

    journal_id          uuid,
    bank_statement_id   bigint,
    reconciled_at       timestamptz,
    reconciled_by       uuid,

    is_deleted          boolean NOT NULL DEFAULT false,
    deleted_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid,
    updated_by          uuid,

    CONSTRAINT gen_inv_payments_pkey PRIMARY KEY (id),
    CONSTRAINT gen_inv_payments_company_number_key
        UNIQUE (company_id, payment_number),
    CONSTRAINT gen_inv_payments_company_id_fkey FOREIGN KEY (company_id)
        REFERENCES public.companies (id) ON DELETE CASCADE,
    CONSTRAINT gen_inv_payments_branch_id_fkey FOREIGN KEY (branch_id)
        REFERENCES public.branches (id),
    CONSTRAINT gen_inv_payments_invoice_fkey FOREIGN KEY (general_invoice_id)
        REFERENCES public.general_invoices (id),
    CONSTRAINT gen_inv_payments_bank_account_fkey FOREIGN KEY (bank_account_id)
        REFERENCES public.bank_accounts (id),
    CONSTRAINT gen_inv_payments_journal_fkey FOREIGN KEY (journal_id)
        REFERENCES public.journal_headers (id),
    CONSTRAINT gen_inv_payments_bank_stmt_fkey FOREIGN KEY (bank_statement_id)
        REFERENCES public.bank_statements (id),
    CONSTRAINT gen_inv_payments_created_by_fkey FOREIGN KEY (created_by)
        REFERENCES public.auth_users (id),
    CONSTRAINT gen_inv_payments_approved_by_fkey FOREIGN KEY (approved_by)
        REFERENCES public.auth_users (id),
    CONSTRAINT gen_inv_payments_paid_by_fkey FOREIGN KEY (paid_by)
        REFERENCES public.auth_users (id),
    CONSTRAINT gen_inv_payments_status_check CHECK (
        status = ANY (ARRAY['DRAFT','APPROVED','REJECTED','PAID','RECONCILED'])
    ),
    CONSTRAINT gen_inv_payments_method_check CHECK (
        payment_method = ANY (ARRAY['TRANSFER','CASH'])
    ),
    CONSTRAINT gen_inv_payments_amount_check CHECK (total_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_gen_pay_company
    ON public.general_invoice_payments (company_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_gen_pay_branch
    ON public.general_invoice_payments (branch_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_gen_pay_invoice
    ON public.general_invoice_payments (general_invoice_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_gen_pay_status
    ON public.general_invoice_payments (status) WHERE is_deleted = false;

CREATE OR REPLACE TRIGGER general_invoice_payments_updated_at
    BEFORE UPDATE ON public.general_invoice_payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 5. GENERAL INVOICE TEMPLATES (recurring)
-- Generate invoice baru dari template, tidak auto-post
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.general_invoice_templates (
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id          uuid NOT NULL,
    branch_id           uuid NOT NULL,
    template_name       varchar(255) NOT NULL,
    vendor_id           uuid NOT NULL,
    expense_type        varchar(50) NOT NULL,
    is_confidential     boolean NOT NULL DEFAULT false,

    -- Recurring schedule
    recurrence          varchar(20) NOT NULL DEFAULT 'MONTHLY',
    -- 'MONTHLY','QUARTERLY','YEARLY'

    -- Nominal — bisa null kalau nominal selalu berubah (listrik)
    default_amount      numeric(20,4),

    -- Default due date offset dari invoice date (misal 14 hari)
    due_date_offset_days integer NOT NULL DEFAULT 14,

    notes               text,
    is_active           boolean NOT NULL DEFAULT true,

    -- Template lines (COA mapping)
    -- Lines disimpan di general_invoice_template_lines

    last_generated_at   date,

    is_deleted          boolean NOT NULL DEFAULT false,
    deleted_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid,
    updated_by          uuid,

    CONSTRAINT gen_inv_templates_pkey PRIMARY KEY (id),
    CONSTRAINT gen_inv_templates_company_fkey FOREIGN KEY (company_id)
        REFERENCES public.companies (id) ON DELETE CASCADE,
    CONSTRAINT gen_inv_templates_branch_fkey FOREIGN KEY (branch_id)
        REFERENCES public.branches (id),
    CONSTRAINT gen_inv_templates_vendor_fkey FOREIGN KEY (vendor_id)
        REFERENCES public.vendors (id),
    CONSTRAINT gen_inv_templates_created_by_fkey FOREIGN KEY (created_by)
        REFERENCES public.auth_users (id),
    CONSTRAINT gen_inv_templates_recurrence_check CHECK (
        recurrence = ANY (ARRAY['MONTHLY','QUARTERLY','YEARLY'])
    ),
    CONSTRAINT gen_inv_templates_expense_type_check CHECK (
        expense_type = ANY (
            ARRAY['UTILITY','RENT','SALARY_SUPPORT','SUBSCRIPTION','MAINTENANCE','OTHER']
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_gen_tmpl_company
    ON public.general_invoice_templates (company_id) WHERE is_deleted = false;

CREATE OR REPLACE TRIGGER general_invoice_templates_updated_at
    BEFORE UPDATE ON public.general_invoice_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 6. GENERAL INVOICE TEMPLATE LINES
-- COA default per template
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.general_invoice_template_lines (
    id                      uuid NOT NULL DEFAULT gen_random_uuid(),
    template_id             uuid NOT NULL,
    line_number             integer NOT NULL,
    account_id              uuid NOT NULL,
    description             varchar(500),
    -- amount_ratio: persentase dari total (null = user isi manual saat generate)
    amount_ratio            numeric(5,4),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT gen_tmpl_lines_pkey PRIMARY KEY (id),
    CONSTRAINT gen_tmpl_lines_template_fkey FOREIGN KEY (template_id)
        REFERENCES public.general_invoice_templates (id) ON DELETE CASCADE,
    CONSTRAINT gen_tmpl_lines_account_fkey FOREIGN KEY (account_id)
        REFERENCES public.chart_of_accounts (id),
    CONSTRAINT gen_tmpl_lines_unique UNIQUE (template_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_gen_tmpl_lines_template
    ON public.general_invoice_template_lines (template_id);

CREATE OR REPLACE TRIGGER general_invoice_template_lines_updated_at
    BEFORE UPDATE ON public.general_invoice_template_lines
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 7. ACCOUNTING PURPOSE untuk General AP
-- Tambah purpose baru: GEN-AP-LIABILITY (akun hutang usaha umum)
-- Mapping dilakukan via accounting_purposes + accounting_purpose_accounts
-- yang sudah ada di sistem
-- ------------------------------------------------------------
-- (tidak ada tabel baru, cukup seed data di accounting_purposes)
-- Purpose key: 'GEN-AP-LIABILITY'
-- → credit account saat invoice POSTED (Hutang Usaha Umum)
-- → debit account saat payment PAID (Hutang Usaha Umum)
