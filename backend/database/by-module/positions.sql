-- ============================================
-- Module: positions
-- Generated: 2026-06-09T16:36:06.338Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.positions
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    department_id uuid NOT NULL,
    position_code character varying(30) COLLATE pg_catalog."default" NOT NULL,
    position_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    can_access_all_wip boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    role_id uuid,
    CONSTRAINT positions_pkey PRIMARY KEY (id),
    CONSTRAINT positions_company_id_position_code_key UNIQUE (company_id, position_code)
);

COMMENT ON COLUMN public.positions.role_id
    IS 'Auto-generated role assigned to this position, mapping Positions directly to Permissions';

CREATE INDEX IF NOT EXISTS idx_positions_company
    ON public.positions(company_id);
CREATE INDEX IF NOT EXISTS idx_positions_department
    ON public.positions(department_id);
CREATE INDEX IF NOT EXISTS idx_positions_role
    ON public.positions(role_id);

ALTER TABLE IF EXISTS public.positions
    ADD CONSTRAINT positions_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.positions
    ADD CONSTRAINT positions_department_id_fkey FOREIGN KEY (department_id)
    REFERENCES public.departments (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.positions
    ADD CONSTRAINT positions_role_id_fkey FOREIGN KEY (role_id)
    REFERENCES public.perm_roles (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;