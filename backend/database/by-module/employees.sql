-- ============================================
-- Module: employees
-- Generated: 2026-06-09T16:36:06.338Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.employees
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    employee_id character varying(50) COLLATE pg_catalog."default" NOT NULL,
    full_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    join_date date NOT NULL,
    resign_date date,
    status_employee character varying(50) COLLATE pg_catalog."default" NOT NULL,
    end_date date,
    sign_date date,
    email character varying(255) COLLATE pg_catalog."default",
    birth_date date,
    birth_place character varying(255) COLLATE pg_catalog."default",
    citizen_id_address text COLLATE pg_catalog."default",
    ptkp_status character varying(10) COLLATE pg_catalog."default" NOT NULL,
    bank_name character varying(100) COLLATE pg_catalog."default",
    bank_account character varying(50) COLLATE pg_catalog."default",
    bank_account_holder character varying(255) COLLATE pg_catalog."default",
    nik character varying(20) COLLATE pg_catalog."default",
    mobile_phone character varying(20) COLLATE pg_catalog."default",
    brand_name character varying(100) COLLATE pg_catalog."default",
    religion character varying(50) COLLATE pg_catalog."default",
    gender character varying(10) COLLATE pg_catalog."default",
    marital_status character varying(20) COLLATE pg_catalog."default",
    profile_picture text COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    is_active boolean NOT NULL DEFAULT true,
    deleted_at timestamp with time zone,
    CONSTRAINT employees_pkey PRIMARY KEY (id),
    CONSTRAINT employees_email_key UNIQUE (email),
    CONSTRAINT employees_employee_id_key UNIQUE (employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employees_user_id
    ON public.employees(user_id);

ALTER TABLE IF EXISTS public.employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.employee_branches
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    role_id uuid NOT NULL,
    approval_limit numeric(15, 2) NOT NULL DEFAULT 0,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'active'::character varying,
    position_id uuid,
    CONSTRAINT employee_branches_pkey PRIMARY KEY (id),
    CONSTRAINT employee_branches_unique UNIQUE (employee_id, branch_id)
);

COMMENT ON COLUMN public.employee_branches.position_id
    IS 'Position of employee at this specific branch';

CREATE INDEX IF NOT EXISTS idx_employee_branches_branch_id
    ON public.employee_branches(branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_branches_employee_id
    ON public.employee_branches(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_branches_position
    ON public.employee_branches(position_id);
CREATE INDEX IF NOT EXISTS idx_employee_branches_role
    ON public.employee_branches(role_id);

ALTER TABLE IF EXISTS public.employee_branches
    ADD CONSTRAINT employee_branches_branch_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.employee_branches
    ADD CONSTRAINT employee_branches_employee_fkey FOREIGN KEY (employee_id)
    REFERENCES public.employees (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.employee_branches
    ADD CONSTRAINT employee_branches_position_id_fkey FOREIGN KEY (position_id)
    REFERENCES public.positions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.employee_branches
    ADD CONSTRAINT employee_branches_role_id_fkey FOREIGN KEY (role_id)
    REFERENCES public.perm_roles (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.employee_positions
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL,
    position_id uuid NOT NULL,
    is_primary boolean NOT NULL DEFAULT false,
    assigned_at timestamp with time zone NOT NULL DEFAULT now(),
    assigned_by uuid,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    CONSTRAINT employee_positions_pkey PRIMARY KEY (id),
    CONSTRAINT employee_positions_employee_id_position_id_key UNIQUE (employee_id, position_id)
);

CREATE INDEX IF NOT EXISTS idx_emp_positions_employee
    ON public.employee_positions(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_positions_position
    ON public.employee_positions(position_id);

ALTER TABLE IF EXISTS public.employee_positions
    ADD CONSTRAINT employee_positions_employee_id_fkey FOREIGN KEY (employee_id)
    REFERENCES public.employees (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.employee_positions
    ADD CONSTRAINT employee_positions_position_id_fkey FOREIGN KEY (position_id)
    REFERENCES public.positions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;