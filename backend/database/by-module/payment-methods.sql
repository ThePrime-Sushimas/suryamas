-- ============================================
-- Module: payment-methods
-- Generated: 2026-06-09T16:36:06.340Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_methods
(
    id serial NOT NULL,
    company_id uuid NOT NULL,
    code character varying(20) COLLATE pg_catalog."default" NOT NULL,
    name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    payment_type character varying(20) COLLATE pg_catalog."default" NOT NULL,
    bank_account_id integer,
    coa_account_id uuid,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    requires_bank_account boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp without time zone,
    deleted_by uuid,
    fee_percentage numeric(7, 4) NOT NULL DEFAULT 0,
    fee_fixed_amount numeric(15, 2) NOT NULL DEFAULT 0,
    fee_fixed_per_transaction boolean NOT NULL DEFAULT false,
    fee_coa_account_id uuid,
    fee_liability_coa_account_id uuid,
    pos_id integer,
    CONSTRAINT payment_methods_pkey PRIMARY KEY (id),
    CONSTRAINT payment_methods_company_id_code_key UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_bank_account
    ON public.payment_methods(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_company
    ON public.payment_methods(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_fee_coa
    ON public.payment_methods(fee_coa_account_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_fee_liability_coa
    ON public.payment_methods(fee_liability_coa_account_id);

ALTER TABLE IF EXISTS public.payment_methods
    ADD CONSTRAINT payment_methods_bank_account_id_fkey FOREIGN KEY (bank_account_id)
    REFERENCES public.bank_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payment_methods
    ADD CONSTRAINT payment_methods_coa_account_id_fkey FOREIGN KEY (coa_account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payment_methods
    ADD CONSTRAINT payment_methods_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.payment_methods
    ADD CONSTRAINT payment_methods_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payment_methods
    ADD CONSTRAINT payment_methods_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payment_methods
    ADD CONSTRAINT payment_methods_fee_coa_account_id_fkey FOREIGN KEY (fee_coa_account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payment_methods
    ADD CONSTRAINT payment_methods_fee_liability_coa_account_id_fkey FOREIGN KEY (fee_liability_coa_account_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payment_methods
    ADD CONSTRAINT payment_methods_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.payment_method_group_mappings
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL,
    company_id uuid NOT NULL,
    payment_method_id integer NOT NULL,
    created_by text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT payment_method_group_mappings_pkey PRIMARY KEY (id),
    CONSTRAINT uq_pmgm_company_pm UNIQUE (company_id, payment_method_id)
);

CREATE INDEX IF NOT EXISTS idx_pmgm_group_id
    ON public.payment_method_group_mappings(group_id);

ALTER TABLE IF EXISTS public.payment_method_group_mappings
    ADD CONSTRAINT payment_method_group_mappings_group_id_fkey FOREIGN KEY (group_id)
    REFERENCES public.payment_method_groups (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.payment_method_group_mappings
    ADD CONSTRAINT payment_method_group_mappings_payment_method_id_fkey FOREIGN KEY (payment_method_id)
    REFERENCES public.payment_methods (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.payment_method_groups
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    name text COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    color text COLLATE pg_catalog."default" DEFAULT '#6366f1'::text,
    icon text COLLATE pg_catalog."default",
    display_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_by text COLLATE pg_catalog."default",
    updated_by text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT payment_method_groups_pkey PRIMARY KEY (id),
    CONSTRAINT uq_pmg_company_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.payment_method_alerts
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    payment_method_id integer NOT NULL,
    threshold_amount numeric(15, 2) NOT NULL,
    telegram_chat_id character varying(50) COLLATE pg_catalog."default" NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    last_triggered_date date,
    last_triggered_amount numeric(15, 2) DEFAULT 0,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT payment_method_alerts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_pma_payment_method
    ON public.payment_method_alerts(payment_method_id);

ALTER TABLE IF EXISTS public.payment_method_alerts
    ADD CONSTRAINT payment_method_alerts_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.payment_method_alerts
    ADD CONSTRAINT payment_method_alerts_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.employees (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.payment_method_alerts
    ADD CONSTRAINT payment_method_alerts_payment_method_id_fkey FOREIGN KEY (payment_method_id)
    REFERENCES public.payment_methods (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.payment_method_alerts
    ADD CONSTRAINT payment_method_alerts_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.employees (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.payment_method_alert_history
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    alert_id uuid NOT NULL,
    payment_method_id integer NOT NULL,
    payment_method_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    company_id uuid NOT NULL,
    triggered_date date NOT NULL,
    triggered_amount numeric(15, 2) NOT NULL,
    threshold_amount numeric(15, 2) NOT NULL,
    branch_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
    telegram_chat_id character varying(50) COLLATE pg_catalog."default" NOT NULL,
    telegram_sent_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payment_method_alert_history_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.payment_method_alert_history
    IS 'History of all payment method alerts that have been sent';
COMMENT ON COLUMN public.payment_method_alert_history.branch_breakdown
    IS 'JSON array of branch totals: [{"branch_name": "...", "amount": 123.45}]';

CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id
    ON public.payment_method_alert_history(alert_id);

ALTER TABLE IF EXISTS public.payment_method_alert_history
    ADD CONSTRAINT payment_method_alert_history_alert_id_fkey FOREIGN KEY (alert_id)
    REFERENCES public.payment_method_alerts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.payment_method_alert_history
    ADD CONSTRAINT payment_method_alert_history_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.payment_method_alert_history
    ADD CONSTRAINT payment_method_alert_history_payment_method_id_fkey FOREIGN KEY (payment_method_id)
    REFERENCES public.payment_methods (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;