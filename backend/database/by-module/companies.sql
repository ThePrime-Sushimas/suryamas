-- ============================================
-- Module: companies
-- Generated: 2026-06-09T16:36:06.339Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.companies
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_code character varying(20) COLLATE pg_catalog."default" NOT NULL,
    company_name character varying(200) COLLATE pg_catalog."default" NOT NULL,
    company_type character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT 'PT'::character varying,
    npwp character varying(20) COLLATE pg_catalog."default",
    website character varying(255) COLLATE pg_catalog."default",
    email character varying(100) COLLATE pg_catalog."default",
    phone character varying(20) COLLATE pg_catalog."default",
    status character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT companies_pkey PRIMARY KEY (id),
    CONSTRAINT companies_company_code_key UNIQUE (company_code),
    CONSTRAINT companies_npwp_key UNIQUE (npwp)
);


END;