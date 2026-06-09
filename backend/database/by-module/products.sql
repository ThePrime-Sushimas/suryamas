-- ============================================
-- Module: products
-- Generated: 2026-06-09T16:36:06.343Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.pricelists
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    product_id uuid NOT NULL,
    uom_id uuid NOT NULL,
    price numeric(15, 2) NOT NULL,
    currency character varying(3) COLLATE pg_catalog."default" NOT NULL DEFAULT 'IDR'::character varying,
    valid_from date NOT NULL DEFAULT CURRENT_DATE,
    valid_to date,
    status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'DRAFT'::character varying,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    source character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'MANUAL'::character varying,
    purchase_invoice_id uuid,
    CONSTRAINT pricelists_pkey PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public.pricelists
    ADD CONSTRAINT fk_pricelist_company FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pricelists
    ADD CONSTRAINT fk_pricelist_product FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pricelists
    ADD CONSTRAINT fk_pricelist_supplier FOREIGN KEY (supplier_id)
    REFERENCES public.suppliers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pricelists
    ADD CONSTRAINT fk_pricelist_uom FOREIGN KEY (uom_id)
    REFERENCES public.product_uoms (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pricelists
    ADD CONSTRAINT fk_pricelist_updated_by FOREIGN KEY (updated_by)
    REFERENCES public.employees (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pricelists
    ADD CONSTRAINT pricelists_purchase_invoice_id_fkey FOREIGN KEY (purchase_invoice_id)
    REFERENCES public.purchase_invoices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.products
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    product_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    product_name character varying(200) COLLATE pg_catalog."default" NOT NULL,
    bom_name character varying(200) COLLATE pg_catalog."default",
    category_id uuid NOT NULL,
    sub_category_id uuid NOT NULL,
    is_requestable boolean DEFAULT true,
    is_purchasable boolean DEFAULT true,
    notes text COLLATE pg_catalog."default",
    status character varying(20) COLLATE pg_catalog."default" DEFAULT 'ACTIVE'::character varying,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    product_type character varying(20) COLLATE pg_catalog."default" DEFAULT 'raw'::character varying,
    average_cost numeric(12, 2) DEFAULT 0,
    default_purchase_unit character varying(50) COLLATE pg_catalog."default",
    station character varying(30) COLLATE pg_catalog."default",
    yield_factor numeric(5, 4) DEFAULT 1.0000,
    risk_category character varying(10) COLLATE pg_catalog."default" DEFAULT 'LOW'::character varying,
    default_source character varying(20) COLLATE pg_catalog."default" DEFAULT 'SUPPLIER'::character varying,
    requires_processing boolean NOT NULL DEFAULT false,
    reorder_point numeric(20, 4) DEFAULT NULL::numeric,
    safety_stock numeric(20, 4) DEFAULT NULL::numeric,
    CONSTRAINT products_pkey PRIMARY KEY (id),
    CONSTRAINT products_product_code_key UNIQUE (product_code)
);

COMMENT ON COLUMN public.products.requires_processing
    IS 'true = perlu proses (potong/trim) sebelum masuk gudang (salmon, ayam)';

CREATE INDEX IF NOT EXISTS idx_products_category
    ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sub_category
    ON public.products(sub_category_id);

ALTER TABLE IF EXISTS public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES public.categories (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;
ALTER TABLE IF EXISTS public.products
    ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.products
    ADD CONSTRAINT products_sub_category_id_fkey FOREIGN KEY (sub_category_id)
    REFERENCES public.sub_categories (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;
ALTER TABLE IF EXISTS public.products
    ADD CONSTRAINT products_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.categories
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    category_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    category_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    sort_order integer DEFAULT 0,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    is_active boolean,
    CONSTRAINT categories_pkey PRIMARY KEY (id),
    CONSTRAINT categories_category_code_key UNIQUE (category_code)
);

ALTER TABLE IF EXISTS public.categories
    ADD CONSTRAINT categories_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.categories
    ADD CONSTRAINT categories_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.sub_categories
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL,
    sub_category_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    sub_category_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    sort_order integer DEFAULT 0,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    CONSTRAINT sub_categories_pkey PRIMARY KEY (id),
    CONSTRAINT sub_categories_category_id_sub_category_code_key UNIQUE (category_id, sub_category_code)
);

CREATE INDEX IF NOT EXISTS idx_sub_categories_category
    ON public.sub_categories(category_id);

ALTER TABLE IF EXISTS public.sub_categories
    ADD CONSTRAINT sub_categories_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES public.categories (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.sub_categories
    ADD CONSTRAINT sub_categories_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.sub_categories
    ADD CONSTRAINT sub_categories_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.pricelist_price_changes
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    product_id uuid NOT NULL,
    uom_id uuid NOT NULL,
    old_price numeric(20, 4),
    new_price numeric(20, 4) NOT NULL,
    change_amount numeric(20, 4),
    change_pct numeric(8, 2),
    effective_date date NOT NULL,
    source character varying(20) COLLATE pg_catalog."default" NOT NULL,
    purchase_invoice_id uuid,
    purchase_invoice_line_id uuid,
    pricelist_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    CONSTRAINT pricelist_price_changes_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_ppc_pi
    ON public.pricelist_price_changes(purchase_invoice_id);

ALTER TABLE IF EXISTS public.pricelist_price_changes
    ADD CONSTRAINT pricelist_price_changes_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pricelist_price_changes
    ADD CONSTRAINT pricelist_price_changes_pricelist_id_fkey FOREIGN KEY (pricelist_id)
    REFERENCES public.pricelists (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pricelist_price_changes
    ADD CONSTRAINT pricelist_price_changes_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pricelist_price_changes
    ADD CONSTRAINT pricelist_price_changes_purchase_invoice_id_fkey FOREIGN KEY (purchase_invoice_id)
    REFERENCES public.purchase_invoices (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pricelist_price_changes
    ADD CONSTRAINT pricelist_price_changes_purchase_invoice_line_id_fkey FOREIGN KEY (purchase_invoice_line_id)
    REFERENCES public.purchase_invoice_lines (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pricelist_price_changes
    ADD CONSTRAINT pricelist_price_changes_supplier_id_fkey FOREIGN KEY (supplier_id)
    REFERENCES public.suppliers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pricelist_price_changes
    ADD CONSTRAINT pricelist_price_changes_uom_id_fkey FOREIGN KEY (uom_id)
    REFERENCES public.product_uoms (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.product_uoms
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL,
    metric_unit_id uuid,
    conversion_factor numeric(15, 6) NOT NULL,
    is_base_unit boolean DEFAULT false,
    base_price numeric(15, 2),
    is_default_stock_unit boolean DEFAULT false,
    is_default_purchase_unit boolean DEFAULT false,
    is_default_transfer_unit boolean DEFAULT false,
    status_uom character varying(20) COLLATE pg_catalog."default" DEFAULT 'ACTIVE'::character varying,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT product_uoms_pkey PRIMARY KEY (id),
    CONSTRAINT product_uoms_product_id_metric_unit_id_key UNIQUE (product_id, metric_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_product_uoms_metric_unit
    ON public.product_uoms(metric_unit_id);
CREATE INDEX IF NOT EXISTS unique_base_unit_per_product
    ON public.product_uoms(product_id);

ALTER TABLE IF EXISTS public.product_uoms
    ADD CONSTRAINT product_uoms_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.product_uoms
    ADD CONSTRAINT product_uoms_metric_unit_id_fkey FOREIGN KEY (metric_unit_id)
    REFERENCES public.metric_units (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.product_uoms
    ADD CONSTRAINT product_uoms_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.product_uoms
    ADD CONSTRAINT product_uoms_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.metric_units
(
    metric_type character varying(20) COLLATE pg_catalog."default" NOT NULL,
    unit_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    notes text COLLATE pg_catalog."default",
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100) COLLATE pg_catalog."default",
    updated_by character varying(100) COLLATE pg_catalog."default",
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    CONSTRAINT metric_units_pkey PRIMARY KEY (id),
    CONSTRAINT unique_metric_unit UNIQUE (metric_type, unit_name)
);

CREATE TABLE IF NOT EXISTS public.product_output_templates
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL,
    output_product_id uuid NOT NULL,
    output_uom text COLLATE pg_catalog."default" NOT NULL,
    suggested_pct numeric(5, 2),
    sort_order integer NOT NULL DEFAULT 0,
    notes text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    bears_cost boolean NOT NULL DEFAULT true,
    CONSTRAINT product_output_templates_pkey PRIMARY KEY (id),
    CONSTRAINT product_output_templates_product_id_output_product_id_key UNIQUE (product_id, output_product_id)
);

COMMENT ON COLUMN public.product_output_templates.bears_cost
    IS 'If true, this output absorbs proportional input cost. False = by-product (cost = 0).';

CREATE INDEX IF NOT EXISTS idx_product_output_templates_product_id
    ON public.product_output_templates(product_id);

ALTER TABLE IF EXISTS public.product_output_templates
    ADD CONSTRAINT product_output_templates_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.product_output_templates
    ADD CONSTRAINT product_output_templates_output_product_id_fkey FOREIGN KEY (output_product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.product_output_templates
    ADD CONSTRAINT product_output_templates_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.product_stock_configs
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    product_id uuid NOT NULL,
    warehouse_id uuid,
    reorder_point numeric(20, 4),
    safety_stock numeric(20, 4),
    notes text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT product_stock_configs_pkey PRIMARY KEY (id),
    CONSTRAINT product_stock_configs_unique UNIQUE (branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_psc_branch
    ON public.product_stock_configs(branch_id);
CREATE INDEX IF NOT EXISTS idx_psc_company
    ON public.product_stock_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_psc_product
    ON public.product_stock_configs(product_id);

ALTER TABLE IF EXISTS public.product_stock_configs
    ADD CONSTRAINT product_stock_configs_branch_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.product_stock_configs
    ADD CONSTRAINT product_stock_configs_company_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.product_stock_configs
    ADD CONSTRAINT product_stock_configs_product_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;