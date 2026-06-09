-- ============================================
-- Module: accounting
-- Generated: 2026-06-09T16:36:06.317Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.account_period_balances
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    bank_account_id integer NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    opening_balance numeric(15, 2) NOT NULL DEFAULT 0,
    source text COLLATE pg_catalog."default" NOT NULL DEFAULT 'MANUAL'::text,
    previous_period_id uuid,
    notes text COLLATE pg_catalog."default",
    created_by text COLLATE pg_catalog."default",
    updated_by text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT account_period_balances_pkey PRIMARY KEY (id),
    CONSTRAINT uq_period_balance_account_start UNIQUE (bank_account_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_apb_bank_account_id
    ON public.account_period_balances(bank_account_id);

ALTER TABLE IF EXISTS public.account_period_balances
    ADD CONSTRAINT account_period_balances_bank_account_id_fkey FOREIGN KEY (bank_account_id)
    REFERENCES public.bank_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.account_period_balances
    ADD CONSTRAINT account_period_balances_previous_period_id_fkey FOREIGN KEY (previous_period_id)
    REFERENCES public.account_period_balances (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.journal_headers
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid,
    journal_number character varying(50) COLLATE pg_catalog."default" NOT NULL,
    sequence_number integer NOT NULL,
    journal_date date NOT NULL,
    period character varying(7) COLLATE pg_catalog."default" NOT NULL,
    journal_type journal_type_enum NOT NULL,
    source_module character varying(50) COLLATE pg_catalog."default",
    reference_type character varying(50) COLLATE pg_catalog."default",
    reference_id uuid,
    reference_number character varying(100) COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default" NOT NULL,
    total_debit numeric(15, 2) NOT NULL DEFAULT 0,
    total_credit numeric(15, 2) NOT NULL DEFAULT 0,
    currency character varying(3) COLLATE pg_catalog."default" NOT NULL DEFAULT 'IDR'::character varying,
    exchange_rate numeric(15, 6) NOT NULL DEFAULT 1,
    status journal_status_enum NOT NULL DEFAULT 'DRAFT'::journal_status_enum,
    is_reversed boolean DEFAULT false,
    reversed_by uuid,
    reversal_date date,
    reversal_reason text COLLATE pg_catalog."default",
    submitted_at timestamp without time zone,
    submitted_by uuid,
    approved_at timestamp without time zone,
    approved_by uuid,
    rejected_at timestamp without time zone,
    rejected_by uuid,
    rejection_reason text COLLATE pg_catalog."default",
    posted_at timestamp without time zone,
    posted_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    created_by uuid,
    updated_at timestamp without time zone DEFAULT now(),
    updated_by uuid,
    deleted_at timestamp without time zone,
    deleted_by uuid,
    tags jsonb,
    approval_flow_id uuid,
    is_auto boolean DEFAULT false,
    reversal_of_journal_id uuid,
    reversed_by_journal_id uuid,
    CONSTRAINT journal_headers_pkey PRIMARY KEY (id),
    CONSTRAINT unique_sequence UNIQUE (company_id, journal_type, period, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_journal_headers_branch
    ON public.journal_headers(branch_id);
CREATE INDEX IF NOT EXISTS idx_journal_headers_company
    ON public.journal_headers(company_id);

ALTER TABLE IF EXISTS public.journal_headers
    ADD CONSTRAINT journal_headers_approved_by_auth_users_fkey FOREIGN KEY (approved_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.journal_headers
    ADD CONSTRAINT journal_headers_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.journal_headers
    ADD CONSTRAINT journal_headers_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.journal_headers
    ADD CONSTRAINT journal_headers_created_by_auth_users_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.journal_headers
    ADD CONSTRAINT journal_headers_deleted_by_auth_users_fkey FOREIGN KEY (deleted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.journal_headers
    ADD CONSTRAINT journal_headers_posted_by_auth_users_fkey FOREIGN KEY (posted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.journal_headers
    ADD CONSTRAINT journal_headers_rejected_by_auth_users_fkey FOREIGN KEY (rejected_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.journal_headers
    ADD CONSTRAINT journal_headers_reversed_by_fkey FOREIGN KEY (reversed_by)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.journal_headers
    ADD CONSTRAINT journal_headers_submitted_by_auth_users_fkey FOREIGN KEY (submitted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.journal_headers
    ADD CONSTRAINT journal_headers_updated_by_auth_users_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.accounting_purposes
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid,
    purpose_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    purpose_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    applied_to character varying(50) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    is_active boolean NOT NULL DEFAULT true,
    is_system boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean NOT NULL DEFAULT false,
    CONSTRAINT accounting_purposes_pkey PRIMARY KEY (id),
    CONSTRAINT uq_accounting_purposes_code UNIQUE (company_id, purpose_code)
);

CREATE INDEX IF NOT EXISTS idx_accounting_purposes_company
    ON public.accounting_purposes(company_id);

ALTER TABLE IF EXISTS public.accounting_purposes
    ADD CONSTRAINT fk_accounting_purposes_branch FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.accounting_purposes
    ADD CONSTRAINT fk_accounting_purposes_company FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.accounting_purposes
    ADD CONSTRAINT fk_accounting_purposes_created_by FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.accounting_purposes
    ADD CONSTRAINT fk_accounting_purposes_deleted_by FOREIGN KEY (deleted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.accounting_purposes
    ADD CONSTRAINT fk_accounting_purposes_updated_by FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.accounting_purpose_accounts
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    purpose_id uuid NOT NULL,
    account_id uuid NOT NULL,
    side character varying(6) COLLATE pg_catalog."default" NOT NULL,
    is_required boolean NOT NULL DEFAULT true,
    is_auto boolean NOT NULL DEFAULT true,
    priority integer NOT NULL DEFAULT 1,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean NOT NULL DEFAULT false,
    field_mapping character varying(50) COLLATE pg_catalog."default",
    CONSTRAINT accounting_purpose_accounts_pkey PRIMARY KEY (id),
    CONSTRAINT uq_purpose_account_unique UNIQUE (company_id, purpose_id, side, account_id)
);

CREATE INDEX IF NOT EXISTS idx_purpose_accounts_account
    ON public.accounting_purpose_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_purpose_accounts_company
    ON public.accounting_purpose_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_purpose_accounts_purpose
    ON public.accounting_purpose_accounts(purpose_id);

ALTER TABLE IF EXISTS public.accounting_purpose_accounts
    ADD CONSTRAINT accounting_purpose_accounts_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;
ALTER TABLE IF EXISTS public.accounting_purpose_accounts
    ADD CONSTRAINT accounting_purpose_accounts_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.accounting_purpose_accounts
    ADD CONSTRAINT accounting_purpose_accounts_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.accounting_purpose_accounts
    ADD CONSTRAINT accounting_purpose_accounts_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.accounting_purpose_accounts
    ADD CONSTRAINT accounting_purpose_accounts_purpose_id_fkey FOREIGN KEY (purpose_id)
    REFERENCES public.accounting_purposes (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.accounting_purpose_accounts
    ADD CONSTRAINT accounting_purpose_accounts_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.expense_auto_rules
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    purpose_id uuid NOT NULL,
    pattern text COLLATE pg_catalog."default" NOT NULL,
    match_type character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'CONTAINS'::character varying,
    priority integer NOT NULL DEFAULT 100,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT expense_auto_rules_pkey PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public.expense_auto_rules
    ADD CONSTRAINT expense_auto_rules_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.expense_auto_rules
    ADD CONSTRAINT expense_auto_rules_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.expense_auto_rules
    ADD CONSTRAINT expense_auto_rules_purpose_id_fkey FOREIGN KEY (purpose_id)
    REFERENCES public.accounting_purposes (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.expense_auto_rules
    ADD CONSTRAINT expense_auto_rules_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.journal_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    journal_header_id uuid NOT NULL,
    line_number integer NOT NULL,
    account_id uuid NOT NULL,
    description text COLLATE pg_catalog."default",
    debit_amount numeric(15, 2) NOT NULL DEFAULT 0,
    credit_amount numeric(15, 2) NOT NULL DEFAULT 0,
    currency character varying(3) COLLATE pg_catalog."default" NOT NULL DEFAULT 'IDR'::character varying,
    exchange_rate numeric(15, 6) DEFAULT 1,
    base_debit_amount numeric(15, 2) NOT NULL DEFAULT 0,
    base_credit_amount numeric(15, 2) NOT NULL DEFAULT 0,
    cost_center_id uuid,
    project_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT journal_lines_pkey PRIMARY KEY (id),
    CONSTRAINT unique_line_number UNIQUE (journal_header_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_account
    ON public.journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_header
    ON public.journal_lines(journal_header_id);

ALTER TABLE IF EXISTS public.journal_lines
    ADD CONSTRAINT journal_lines_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.journal_lines
    ADD CONSTRAINT journal_lines_journal_header_id_fkey FOREIGN KEY (journal_header_id)
    REFERENCES public.journal_headers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.fiscal_periods
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    fiscal_year integer NOT NULL,
    period character varying(20) COLLATE pg_catalog."default" NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    is_open boolean NOT NULL DEFAULT true,
    is_adjustment_allowed boolean DEFAULT true,
    is_year_end boolean DEFAULT false,
    opened_at timestamp without time zone DEFAULT now(),
    opened_by uuid,
    closed_at timestamp without time zone,
    closed_by uuid,
    close_reason text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT now(),
    created_by uuid,
    updated_at timestamp without time zone DEFAULT now(),
    updated_by uuid,
    deleted_at timestamp without time zone,
    deleted_by uuid,
    CONSTRAINT fiscal_periods_pkey PRIMARY KEY (id),
    CONSTRAINT unique_company_period UNIQUE (company_id, period)
);

ALTER TABLE IF EXISTS public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_closed_by_fkey FOREIGN KEY (closed_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;
ALTER TABLE IF EXISTS public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_opened_by_fkey FOREIGN KEY (opened_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


END;