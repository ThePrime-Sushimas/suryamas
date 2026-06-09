-- ============================================
-- Module: payment-terms
-- Generated: 2026-06-09T16:36:06.345Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_terms
(
    id_payment_term serial NOT NULL,
    term_code character varying(30) COLLATE pg_catalog."default" NOT NULL,
    term_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    calculation_type character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'from_invoice'::character varying,
    days integer NOT NULL DEFAULT 0,
    payment_dates integer[],
    payment_day_of_week integer,
    early_payment_discount numeric(5, 2) NOT NULL DEFAULT 0,
    early_payment_days integer NOT NULL DEFAULT 0,
    late_payment_penalty numeric(5, 2) NOT NULL DEFAULT 0,
    grace_period_days integer NOT NULL DEFAULT 0,
    minimum_order_amount numeric(15, 2) NOT NULL DEFAULT 0,
    maximum_order_amount numeric(15, 2),
    allowed_payment_methods text[] COLLATE pg_catalog."default",
    requires_guarantee boolean NOT NULL DEFAULT false,
    guarantee_type character varying(50) COLLATE pg_catalog."default",
    seasonal_terms jsonb,
    volume_discount_tiers jsonb,
    is_active boolean NOT NULL DEFAULT true,
    description text COLLATE pg_catalog."default",
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    deleted_at timestamp without time zone,
    created_by uuid,
    deleted_by uuid,
    CONSTRAINT payment_terms_pkey PRIMARY KEY (id_payment_term),
    CONSTRAINT payment_terms_term_code_uniq UNIQUE (term_code)
);

CREATE INDEX IF NOT EXISTS idx_payment_terms_created_by
    ON public.payment_terms(created_by);

ALTER TABLE IF EXISTS public.payment_terms
    ADD CONSTRAINT payment_terms_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payment_terms
    ADD CONSTRAINT payment_terms_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


END;