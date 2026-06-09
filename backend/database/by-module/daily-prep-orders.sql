-- ============================================
-- Module: daily-prep-orders
-- Generated: 2026-06-09T16:36:06.347Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.daily_prep_order_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    dpo_id uuid NOT NULL,
    product_id uuid NOT NULL,
    avg_sales_7d numeric(20, 4) NOT NULL DEFAULT 0,
    avg_sales_30d numeric(20, 4) NOT NULL DEFAULT 0,
    avg_sales_dow numeric(20, 4) NOT NULL DEFAULT 0,
    holiday_factor numeric(6, 4) NOT NULL DEFAULT 1.0000,
    coverage_days numeric(6, 4) NOT NULL DEFAULT 1.5000,
    predicted_need numeric(20, 4) NOT NULL DEFAULT 0,
    current_ready_stock numeric(20, 4) NOT NULL DEFAULT 0,
    current_main_stock numeric(20, 4) NOT NULL DEFAULT 0,
    suggested_qty numeric(20, 4) NOT NULL DEFAULT 0,
    confirmed_qty numeric(20, 4),
    uom character varying(30) COLLATE pg_catalog."default" NOT NULL,
    out_movement_id uuid,
    in_movement_id uuid,
    notes text COLLATE pg_catalog."default",
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT daily_prep_order_lines_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_dpo_lines_dpo
    ON public.daily_prep_order_lines(dpo_id);
CREATE INDEX IF NOT EXISTS idx_dpo_lines_product
    ON public.daily_prep_order_lines(product_id);

ALTER TABLE IF EXISTS public.daily_prep_order_lines
    ADD CONSTRAINT dpo_lines_dpo_fkey FOREIGN KEY (dpo_id)
    REFERENCES public.daily_prep_orders (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.daily_prep_order_lines
    ADD CONSTRAINT dpo_lines_in_movement_fkey FOREIGN KEY (in_movement_id)
    REFERENCES public.stock_movements (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.daily_prep_order_lines
    ADD CONSTRAINT dpo_lines_out_movement_fkey FOREIGN KEY (out_movement_id)
    REFERENCES public.stock_movements (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.daily_prep_order_lines
    ADD CONSTRAINT dpo_lines_product_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.daily_prep_orders
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    dpo_number character varying(50) COLLATE pg_catalog."default" NOT NULL,
    prep_date date NOT NULL,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    source_warehouse_id uuid NOT NULL,
    target_warehouse_id uuid NOT NULL,
    weight_7d numeric(4, 3) NOT NULL,
    weight_30d numeric(4, 3) NOT NULL,
    weight_dow numeric(4, 3) NOT NULL,
    coverage_days numeric(4, 2) NOT NULL,
    holiday_factor_applied numeric(4, 3) NOT NULL DEFAULT 1.000,
    has_upcoming_holiday boolean NOT NULL DEFAULT false,
    confirmed_at timestamp with time zone,
    confirmed_by uuid,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    cancel_reason text COLLATE pg_catalog."default",
    lock_token uuid,
    locked_at timestamp with time zone,
    locked_by uuid,
    notes text COLLATE pg_catalog."default",
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    station_codes text[] COLLATE pg_catalog."default" NOT NULL DEFAULT '{}'::text[],
    CONSTRAINT daily_prep_orders_pkey PRIMARY KEY (id),
    CONSTRAINT daily_prep_orders_number_key UNIQUE (company_id, dpo_number)
);

COMMENT ON COLUMN public.daily_prep_orders.station_codes
    IS 'Position codes selected during DPO generation for station filtering';

CREATE INDEX IF NOT EXISTS idx_dpo_company
    ON public.daily_prep_orders(company_id);

ALTER TABLE IF EXISTS public.daily_prep_orders
    ADD CONSTRAINT daily_prep_orders_branch_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.daily_prep_orders
    ADD CONSTRAINT daily_prep_orders_company_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.daily_prep_orders
    ADD CONSTRAINT daily_prep_orders_source_wh_fkey FOREIGN KEY (source_warehouse_id)
    REFERENCES public.warehouses (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.daily_prep_orders
    ADD CONSTRAINT daily_prep_orders_target_wh_fkey FOREIGN KEY (target_warehouse_id)
    REFERENCES public.warehouses (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.dpo_forecast_configs
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    weight_7d numeric(4, 3) NOT NULL DEFAULT 0.600,
    weight_30d numeric(4, 3) NOT NULL DEFAULT 0.300,
    weight_dow numeric(4, 3) NOT NULL DEFAULT 0.100,
    coverage_days numeric(4, 2) NOT NULL DEFAULT 1.50,
    holiday_factor numeric(4, 3) NOT NULL DEFAULT 1.200,
    lookback_days_short integer NOT NULL DEFAULT 7,
    lookback_days_long integer NOT NULL DEFAULT 30,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT dpo_forecast_configs_pkey PRIMARY KEY (id),
    CONSTRAINT dpo_forecast_configs_unique UNIQUE (company_id, branch_id)
);

ALTER TABLE IF EXISTS public.dpo_forecast_configs
    ADD CONSTRAINT dpo_forecast_configs_branch_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.dpo_forecast_configs
    ADD CONSTRAINT dpo_forecast_configs_company_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;