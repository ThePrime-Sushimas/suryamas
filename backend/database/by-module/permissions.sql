-- ============================================
-- Module: permissions
-- Generated: 2026-06-09T16:36:06.355Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.perm_roles
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying(50) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    is_system_role boolean DEFAULT false,
    parent_role_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT roles_pkey PRIMARY KEY (id),
    CONSTRAINT roles_name_key UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_roles_parent
    ON public.perm_roles(parent_role_id);

ALTER TABLE IF EXISTS public.perm_roles
    ADD CONSTRAINT roles_parent_role_id_fkey FOREIGN KEY (parent_role_id)
    REFERENCES public.perm_roles (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.perm_role_permissions
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    role_id uuid NOT NULL,
    module_id uuid NOT NULL,
    can_view boolean DEFAULT false,
    can_insert boolean DEFAULT false,
    can_update boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    can_approve boolean DEFAULT false,
    can_release boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
    CONSTRAINT role_permissions_role_id_module_id_key UNIQUE (role_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_module
    ON public.perm_role_permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role
    ON public.perm_role_permissions(role_id);

ALTER TABLE IF EXISTS public.perm_role_permissions
    ADD CONSTRAINT role_permissions_module_id_fkey FOREIGN KEY (module_id)
    REFERENCES public.perm_modules (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.perm_role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id)
    REFERENCES public.perm_roles (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.perm_modules
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT modules_pkey PRIMARY KEY (id),
    CONSTRAINT modules_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.perm_user_profiles
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
    CONSTRAINT user_profiles_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role_id
    ON public.perm_user_profiles(role_id);

ALTER TABLE IF EXISTS public.perm_user_profiles
    ADD CONSTRAINT user_profiles_role_id_fkey FOREIGN KEY (role_id)
    REFERENCES public.perm_roles (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.perm_audit_log
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    action character varying(50) COLLATE pg_catalog."default" NOT NULL,
    entity_type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    entity_id character varying(100) COLLATE pg_catalog."default" NOT NULL,
    changed_by uuid,
    old_value jsonb,
    new_value jsonb,
    ip_address inet,
    user_agent text COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    branch_id uuid,
    deleted_at timestamp with time zone,
    changed_by_name text COLLATE pg_catalog."default",
    CONSTRAINT permission_audit_log_pkey PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public.perm_audit_log
    ADD CONSTRAINT perm_audit_log_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;


END;