-- ============================================
-- Module: menus
-- Generated: 2026-06-09T16:36:06.349Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.recipe_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    menu_id uuid NOT NULL,
    product_id uuid,
    wip_id uuid,
    qty numeric(20, 4) NOT NULL,
    uom character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'gram'::character varying,
    cost_per_unit numeric(20, 4) NOT NULL DEFAULT 0,
    line_cost numeric(20, 4) GENERATED ALWAYS AS ((qty * cost_per_unit)) STORED,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT recipe_lines_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_lines_menu
    ON public.recipe_lines(menu_id);
CREATE INDEX IF NOT EXISTS idx_recipe_lines_product
    ON public.recipe_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_lines_wip
    ON public.recipe_lines(wip_id);

ALTER TABLE IF EXISTS public.recipe_lines
    ADD CONSTRAINT recipe_lines_menu_id_fkey FOREIGN KEY (menu_id)
    REFERENCES public.menus (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.recipe_lines
    ADD CONSTRAINT recipe_lines_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.recipe_lines
    ADD CONSTRAINT recipe_lines_wip_id_fkey FOREIGN KEY (wip_id)
    REFERENCES public.wip_items (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.menus
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    pos_menu_id integer,
    category_id uuid NOT NULL,
    group_id uuid,
    menu_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    menu_name character varying(150) COLLATE pg_catalog."default" NOT NULL,
    selling_price numeric(20, 4) NOT NULL DEFAULT 0,
    estimated_cost numeric(20, 4) NOT NULL DEFAULT 0,
    cost_percentage numeric(10, 2) GENERATED ALWAYS AS (
CASE
    WHEN (selling_price > (0)::numeric) THEN ((estimated_cost / selling_price) * (100)::numeric)
    ELSE (0)::numeric
END) STORED,
    has_recipe boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    is_deleted boolean NOT NULL DEFAULT false,
    sync_enabled boolean NOT NULL DEFAULT true,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT menus_pkey PRIMARY KEY (id),
    CONSTRAINT menus_company_id_menu_code_key UNIQUE (company_id, menu_code),
    CONSTRAINT menus_company_id_pos_menu_id_key UNIQUE (company_id, pos_menu_id)
);

CREATE INDEX IF NOT EXISTS idx_menus_category
    ON public.menus(category_id);
CREATE INDEX IF NOT EXISTS idx_menus_group
    ON public.menus(group_id);

ALTER TABLE IF EXISTS public.menus
    ADD CONSTRAINT menus_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES public.menu_categories (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menus
    ADD CONSTRAINT menus_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menus
    ADD CONSTRAINT menus_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menus
    ADD CONSTRAINT menus_group_id_fkey FOREIGN KEY (group_id)
    REFERENCES public.menu_groups (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menus
    ADD CONSTRAINT menus_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.menu_categories
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    category_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    category_code character varying(20) COLLATE pg_catalog."default" NOT NULL,
    sales_coa_id uuid,
    cogs_coa_id uuid,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT menu_categories_pkey PRIMARY KEY (id),
    CONSTRAINT menu_categories_company_id_category_code_key UNIQUE (company_id, category_code)
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_company
    ON public.menu_categories(company_id);

ALTER TABLE IF EXISTS public.menu_categories
    ADD CONSTRAINT menu_categories_cogs_coa_id_fkey FOREIGN KEY (cogs_coa_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menu_categories
    ADD CONSTRAINT menu_categories_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menu_categories
    ADD CONSTRAINT menu_categories_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menu_categories
    ADD CONSTRAINT menu_categories_sales_coa_id_fkey FOREIGN KEY (sales_coa_id)
    REFERENCES public.chart_of_accounts (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menu_categories
    ADD CONSTRAINT menu_categories_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.menu_groups
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    category_id uuid NOT NULL,
    group_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    group_code character varying(20) COLLATE pg_catalog."default" NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT menu_groups_pkey PRIMARY KEY (id),
    CONSTRAINT menu_groups_company_id_group_code_key UNIQUE (company_id, group_code)
);

CREATE INDEX IF NOT EXISTS idx_menu_groups_category
    ON public.menu_groups(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_groups_company
    ON public.menu_groups(company_id);

ALTER TABLE IF EXISTS public.menu_groups
    ADD CONSTRAINT menu_groups_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES public.menu_categories (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menu_groups
    ADD CONSTRAINT menu_groups_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menu_groups
    ADD CONSTRAINT menu_groups_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menu_groups
    ADD CONSTRAINT menu_groups_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.menu_branch_prices
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    menu_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    selling_price numeric(20, 4) NOT NULL,
    price_type character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DINE_IN'::character varying,
    source character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'MANUAL'::character varying,
    synced_at timestamp with time zone,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT menu_branch_prices_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_menu_branch_prices_branch
    ON public.menu_branch_prices(branch_id);
CREATE INDEX IF NOT EXISTS idx_menu_branch_prices_company
    ON public.menu_branch_prices(company_id);
CREATE INDEX IF NOT EXISTS idx_menu_branch_prices_menu
    ON public.menu_branch_prices(menu_id);

ALTER TABLE IF EXISTS public.menu_branch_prices
    ADD CONSTRAINT menu_branch_prices_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menu_branch_prices
    ADD CONSTRAINT menu_branch_prices_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menu_branch_prices
    ADD CONSTRAINT menu_branch_prices_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.menu_branch_prices
    ADD CONSTRAINT menu_branch_prices_menu_id_fkey FOREIGN KEY (menu_id)
    REFERENCES public.menus (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.menu_branch_prices
    ADD CONSTRAINT menu_branch_prices_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;