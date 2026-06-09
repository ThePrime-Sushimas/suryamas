-- ============================================
-- Module: daily-stock-opname
-- Generated: 2026-06-09T16:36:06.349Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.daily_closing_counts
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    closing_date date NOT NULL,
    pic_user_id uuid NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    total_variance_cost numeric(20, 4) NOT NULL DEFAULT 0,
    total_expected_cost numeric(20, 4) NOT NULL DEFAULT 0,
    total_actual_cost numeric(20, 4) NOT NULL DEFAULT 0,
    line_count integer NOT NULL DEFAULT 0,
    completed_count integer NOT NULL DEFAULT 0,
    resolution_note text COLLATE pg_catalog."default",
    resolved_by uuid,
    resolved_at timestamp with time zone,
    confirmed_by uuid,
    confirmed_at timestamp with time zone,
    notes text COLLATE pg_catalog."default",
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    opname_number character varying(50) COLLATE pg_catalog."default",
    position_id uuid,
    classification_version integer NOT NULL DEFAULT 0,
    CONSTRAINT daily_closing_counts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_closing_counts_company
    ON public.daily_closing_counts(company_id);
CREATE INDEX IF NOT EXISTS idx_closing_counts_position
    ON public.daily_closing_counts(position_id);

ALTER TABLE IF EXISTS public.daily_closing_counts
    ADD CONSTRAINT daily_closing_counts_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.daily_closing_counts
    ADD CONSTRAINT daily_closing_counts_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.daily_closing_counts
    ADD CONSTRAINT daily_closing_counts_position_id_fkey FOREIGN KEY (position_id)
    REFERENCES public.positions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.daily_closing_counts
    ADD CONSTRAINT daily_closing_counts_warehouse_id_fkey FOREIGN KEY (warehouse_id)
    REFERENCES public.warehouses (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.daily_closing_count_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    closing_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    product_name character varying(200) COLLATE pg_catalog."default" NOT NULL,
    uom character varying(30) COLLATE pg_catalog."default" NOT NULL,
    system_qty numeric(20, 4) NOT NULL DEFAULT 0,
    expected_qty numeric(20, 4) NOT NULL DEFAULT 0,
    actual_qty numeric(20, 4),
    variance_qty numeric(20, 4),
    variance_pct numeric(10, 2),
    cost_per_unit numeric(20, 4) NOT NULL DEFAULT 0,
    variance_cost numeric(20, 4),
    main_balance numeric(20, 4) NOT NULL DEFAULT 0,
    dpo_in_qty numeric(20, 4) NOT NULL DEFAULT 0,
    theoretical_out numeric(20, 4) NOT NULL DEFAULT 0,
    is_high_risk boolean NOT NULL DEFAULT false,
    requires_photo boolean NOT NULL DEFAULT false,
    photo_url text COLLATE pg_catalog."default",
    has_recipe boolean NOT NULL DEFAULT true,
    has_warning boolean NOT NULL DEFAULT false,
    warning_message text COLLATE pg_catalog."default",
    sort_order integer NOT NULL DEFAULT 0,
    out_movement_id uuid,
    in_movement_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT daily_closing_count_lines_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_closing_lines_closing
    ON public.daily_closing_count_lines(closing_id);
CREATE INDEX IF NOT EXISTS idx_closing_lines_product
    ON public.daily_closing_count_lines(product_id);

ALTER TABLE IF EXISTS public.daily_closing_count_lines
    ADD CONSTRAINT daily_closing_count_lines_closing_id_fkey FOREIGN KEY (closing_id)
    REFERENCES public.daily_closing_counts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.daily_closing_count_lines
    ADD CONSTRAINT daily_closing_count_lines_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.variance_classification_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    closing_id uuid NOT NULL,
    line_id uuid NOT NULL,
    variance_category character varying(20) COLLATE pg_catalog."default" NOT NULL,
    qty numeric(20, 4) NOT NULL,
    shortage_assigned_to uuid,
    shortage_note text COLLATE pg_catalog."default",
    classified_by uuid NOT NULL,
    classified_at timestamp with time zone NOT NULL DEFAULT now(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT variance_classification_lines_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_vcl_closing
    ON public.variance_classification_lines(closing_id);
CREATE INDEX IF NOT EXISTS idx_vcl_line
    ON public.variance_classification_lines(line_id);
CREATE INDEX IF NOT EXISTS idx_vcl_assigned
    ON public.variance_classification_lines(shortage_assigned_to);

ALTER TABLE IF EXISTS public.variance_classification_lines
    ADD CONSTRAINT variance_classification_lines_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.variance_classification_lines
    ADD CONSTRAINT variance_classification_lines_closing_id_fkey FOREIGN KEY (closing_id)
    REFERENCES public.daily_closing_counts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.variance_classification_lines
    ADD CONSTRAINT variance_classification_lines_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.variance_classification_lines
    ADD CONSTRAINT variance_classification_lines_line_id_fkey FOREIGN KEY (line_id)
    REFERENCES public.daily_closing_count_lines (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.variance_classification_lines
    ADD CONSTRAINT variance_classification_lines_shortage_assigned_to_fkey FOREIGN KEY (shortage_assigned_to)
    REFERENCES public.employees (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.opname_reopen_requests
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    closing_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    requested_at timestamp with time zone NOT NULL DEFAULT now(),
    reason text COLLATE pg_catalog."default" NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'PENDING'::character varying,
    responded_by uuid,
    responded_at timestamp with time zone,
    response_note text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT opname_reopen_requests_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_reopen_requests_pending
    ON public.opname_reopen_requests(closing_id);

ALTER TABLE IF EXISTS public.opname_reopen_requests
    ADD CONSTRAINT opname_reopen_requests_closing_id_fkey FOREIGN KEY (closing_id)
    REFERENCES public.daily_closing_counts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.opname_reopen_requests
    ADD CONSTRAINT opname_reopen_requests_requested_by_fkey FOREIGN KEY (requested_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.opname_reopen_requests
    ADD CONSTRAINT opname_reopen_requests_responded_by_fkey FOREIGN KEY (responded_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;