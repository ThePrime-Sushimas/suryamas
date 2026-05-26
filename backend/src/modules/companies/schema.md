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
    CONSTRAINT companies_npwp_key UNIQUE (npwp),
    CONSTRAINT companies_status_check CHECK (status::text = ANY (ARRAY['active'::character varying::text, 'inactive'::character varying::text, 'suspended'::character varying::text, 'closed'::character varying::text]))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.companies
    OWNER to postgres;

GRANT ALL ON TABLE public.companies TO postgres;

GRANT ALL ON TABLE public.companies TO suryamas;
-- Index: idx_companies_created_at

-- DROP INDEX IF EXISTS public.idx_companies_created_at;

CREATE INDEX IF NOT EXISTS idx_companies_created_at
    ON public.companies USING btree
    (created_at ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_companies_status

-- DROP INDEX IF EXISTS public.idx_companies_status;

CREATE INDEX IF NOT EXISTS idx_companies_status
    ON public.companies USING btree
    (status COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_companies_type

-- DROP INDEX IF EXISTS public.idx_companies_type;

CREATE INDEX IF NOT EXISTS idx_companies_type
    ON public.companies USING btree
    (company_type COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;