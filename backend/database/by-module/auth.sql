-- ============================================
-- Module: auth
-- Generated: 2026-06-09T16:36:06.337Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.auth_users
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email character varying(255) COLLATE pg_catalog."default" NOT NULL,
    encrypted_password character varying(255) COLLATE pg_catalog."default" NOT NULL,
    reset_token character varying(255) COLLATE pg_catalog."default",
    reset_token_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT auth_users_pkey PRIMARY KEY (id),
    CONSTRAINT auth_users_email_key UNIQUE (email)
);


END;