-- ============================================
-- Module: notifications
-- Generated: 2026-06-09T16:36:06.355Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.notifications
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    event_key character varying(100) COLLATE pg_catalog."default",
    title character varying(255) COLLATE pg_catalog."default" NOT NULL,
    message text COLLATE pg_catalog."default" NOT NULL,
    type notification_type NOT NULL DEFAULT 'info'::notification_type,
    category notification_category NOT NULL DEFAULT 'system'::notification_category,
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamp with time zone,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
    ON public.notifications(recipient_id);

ALTER TABLE IF EXISTS public.notifications
    ADD CONSTRAINT notifications_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.notifications
    ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.notification_rules
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    event_key character varying(100) COLLATE pg_catalog."default" NOT NULL,
    position_id uuid,
    title_template character varying(255) COLLATE pg_catalog."default" NOT NULL,
    message_template text COLLATE pg_catalog."default" NOT NULL,
    type notification_type NOT NULL DEFAULT 'approval_required'::notification_type,
    category notification_category NOT NULL DEFAULT 'system'::notification_category,
    redirect_url_template character varying(500) COLLATE pg_catalog."default",
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT notification_rules_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_notification_rules_company_active
    ON public.notification_rules(company_id);

ALTER TABLE IF EXISTS public.notification_rules
    ADD CONSTRAINT notification_rules_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.notification_rules
    ADD CONSTRAINT notification_rules_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.notification_rules
    ADD CONSTRAINT notification_rules_position_id_fkey FOREIGN KEY (position_id)
    REFERENCES public.positions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.notification_rules
    ADD CONSTRAINT notification_rules_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;