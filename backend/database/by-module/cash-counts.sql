-- ============================================
-- Module: cash-counts
-- Generated: 2026-06-09T16:36:06.341Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.cash_counts
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    payment_method_id integer NOT NULL,
    system_balance numeric(18, 2) NOT NULL DEFAULT 0,
    transaction_count integer NOT NULL DEFAULT 0,
    physical_count numeric(18, 2),
    difference numeric(18, 2) GENERATED ALWAYS AS ((COALESCE(physical_count, (0)::numeric) - system_balance)) STORED,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'OPEN'::character varying,
    responsible_employee_id uuid,
    notes text COLLATE pg_catalog."default",
    counted_by uuid,
    counted_at timestamp with time zone,
    closed_by uuid,
    closed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,
    branch_name character varying(255) COLLATE pg_catalog."default",
    large_denomination numeric(18, 2),
    small_denomination numeric(18, 2),
    cash_deposit_id uuid,
    CONSTRAINT cash_counts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_cash_counts_deposit
    ON public.cash_counts(cash_deposit_id);

ALTER TABLE IF EXISTS public.cash_counts
    ADD CONSTRAINT cash_counts_cash_deposit_id_fkey FOREIGN KEY (cash_deposit_id)
    REFERENCES public.cash_deposits (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.cash_counts
    ADD CONSTRAINT fk_cash_counts_responsible_employee FOREIGN KEY (responsible_employee_id)
    REFERENCES public.employees (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


END;