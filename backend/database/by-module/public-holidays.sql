-- ============================================
-- Module: public-holidays
-- Generated: 2026-06-09T16:36:06.355Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.public_holidays
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    holiday_date date NOT NULL,
    holiday_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    CONSTRAINT public_holidays_pkey PRIMARY KEY (id),
    CONSTRAINT public_holidays_unique UNIQUE (company_id, holiday_date)
);

ALTER TABLE IF EXISTS public.public_holidays
    ADD CONSTRAINT public_holidays_company_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;