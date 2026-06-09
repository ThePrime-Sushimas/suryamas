-- ============================================
-- Module: jobs
-- Generated: 2026-06-09T16:36:06.354Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.jobs
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    type job_type_enum NOT NULL,
    name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    status job_status_enum NOT NULL DEFAULT 'pending'::job_status_enum,
    progress integer NOT NULL DEFAULT 0,
    result_url text COLLATE pg_catalog."default",
    file_path text COLLATE pg_catalog."default",
    file_size bigint,
    error_message text COLLATE pg_catalog."default",
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_by uuid,
    updated_by uuid,
    module character varying COLLATE pg_catalog."default",
    CONSTRAINT jobs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_company_id
    ON public.jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by
    ON public.jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_by
    ON public.jobs(updated_by);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id
    ON public.jobs(user_id);

ALTER TABLE IF EXISTS public.jobs
    ADD CONSTRAINT jobs_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.jobs
    ADD CONSTRAINT jobs_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.jobs
    ADD CONSTRAINT jobs_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.jobs
    ADD CONSTRAINT jobs_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.jobs
    ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


END;