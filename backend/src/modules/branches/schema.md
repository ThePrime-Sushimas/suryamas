-- Table: public.branches

-- DROP TABLE IF EXISTS public.branches;

CREATE TABLE IF NOT EXISTS public.branches
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    branch_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'active'::character varying,
    address text COLLATE pg_catalog."default",
    city character varying(100) COLLATE pg_catalog."default",
    province character varying(100) COLLATE pg_catalog."default",
    postal_code character varying(20) COLLATE pg_catalog."default",
    country character varying(100) COLLATE pg_catalog."default" DEFAULT 'Indonesia'::character varying,
    phone character varying(20) COLLATE pg_catalog."default",
    whatsapp character varying(20) COLLATE pg_catalog."default",
    email character varying(255) COLLATE pg_catalog."default",
    notes text COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    jam_buka time without time zone NOT NULL DEFAULT '10:00:00'::time without time zone,
    jam_tutup time without time zone NOT NULL DEFAULT '22:00:00'::time without time zone,
    hari_operasional jsonb NOT NULL DEFAULT '[]'::jsonb,
    pos_id integer,
    closed_at timestamp without time zone,
    closed_by uuid,
    closed_reason text COLLATE pg_catalog."default",
    closed_date date,
    CONSTRAINT branches_pkey PRIMARY KEY (id),
    CONSTRAINT branches_branch_code_key UNIQUE (branch_code),
    CONSTRAINT branches_closed_by_fkey FOREIGN KEY (closed_by)
        REFERENCES public.auth_users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT branches_company_id_fkey FOREIGN KEY (company_id)
        REFERENCES public.companies (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT branches_created_by_fkey FOREIGN KEY (created_by)
        REFERENCES public.auth_users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT branches_manager_id_fkey FOREIGN KEY (manager_id)
        REFERENCES public.employees (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT branches_updated_by_fkey FOREIGN KEY (updated_by)
        REFERENCES public.auth_users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT branches_status_check CHECK (status::text = ANY (ARRAY['active'::text, 'inactive'::text, 'closed'::text])),
    CONSTRAINT chk_closed_at CHECK (status::text = 'closed'::text AND closed_at IS NOT NULL OR status::text <> 'closed'::text AND closed_at IS NULL)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.branches
    OWNER to postgres;

GRANT ALL ON TABLE public.branches TO postgres;

GRANT ALL ON TABLE public.branches TO suryamas;
-- Index: idx_branches_branch_code

-- DROP INDEX IF EXISTS public.idx_branches_branch_code;

CREATE INDEX IF NOT EXISTS idx_branches_branch_code
    ON public.branches USING btree
    (branch_code COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_branches_city

-- DROP INDEX IF EXISTS public.idx_branches_city;

CREATE INDEX IF NOT EXISTS idx_branches_city
    ON public.branches USING btree
    (city COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_branches_company_id

-- DROP INDEX IF EXISTS public.idx_branches_company_id;

CREATE INDEX IF NOT EXISTS idx_branches_company_id
    ON public.branches USING btree
    (company_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_branches_manager_id

-- DROP INDEX IF EXISTS public.idx_branches_manager_id;

CREATE INDEX IF NOT EXISTS idx_branches_manager_id
    ON public.branches USING btree
    (manager_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_branches_pos_id

-- DROP INDEX IF EXISTS public.idx_branches_pos_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_pos_id
    ON public.branches USING btree
    (pos_id ASC NULLS LAST)
    TABLESPACE pg_default
    WHERE pos_id IS NOT NULL;
-- Index: idx_branches_status

-- DROP INDEX IF EXISTS public.idx_branches_status;

CREATE INDEX IF NOT EXISTS idx_branches_status
    ON public.branches USING btree
    (status COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;