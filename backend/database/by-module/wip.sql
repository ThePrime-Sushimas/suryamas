-- ============================================
-- Module: wip
-- Generated: 2026-06-09T16:36:06.349Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.wip_items
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    wip_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    wip_name character varying(150) COLLATE pg_catalog."default" NOT NULL,
    uom character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'gram'::character varying,
    yield_qty numeric(20, 4) NOT NULL DEFAULT 1,
    estimated_cost numeric(20, 4) NOT NULL DEFAULT 0,
    cost_per_unit numeric(20, 4) GENERATED ALWAYS AS (
CASE
    WHEN (yield_qty > (0)::numeric) THEN (estimated_cost / yield_qty)
    ELSE (0)::numeric
END) STORED,
    notes text COLLATE pg_catalog."default",
    is_active boolean NOT NULL DEFAULT true,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    output_product_id uuid,
    output_warehouse character varying(50) COLLATE pg_catalog."default" DEFAULT 'READY'::character varying,
    CONSTRAINT wip_items_pkey PRIMARY KEY (id),
    CONSTRAINT wip_items_company_id_wip_code_key UNIQUE (company_id, wip_code)
);

COMMENT ON COLUMN public.wip_items.output_product_id
    IS 'Product hasil produksi WIP ini. Diisi untuk central kitchen (saos dll) agar hasil masuk FINISHED_GOODS. NULL = branch biasa, skip IN_PRODUCTION movement.';
COMMENT ON COLUMN public.wip_items.output_warehouse
    IS 'READY = branch biasa (hasil balik ke READY). FINISHED_GOODS = central kitchen (hasil masuk FG warehouse).';

CREATE INDEX IF NOT EXISTS idx_wip_items_company
    ON public.wip_items(company_id);

ALTER TABLE IF EXISTS public.wip_items
    ADD CONSTRAINT wip_items_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.wip_items
    ADD CONSTRAINT wip_items_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.wip_items
    ADD CONSTRAINT wip_items_output_product_id_fkey FOREIGN KEY (output_product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.wip_items
    ADD CONSTRAINT wip_items_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.wip_ingredients
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    wip_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty numeric(20, 4) NOT NULL,
    uom character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'gram'::character varying,
    cost_per_unit numeric(20, 4) NOT NULL DEFAULT 0,
    line_cost numeric(20, 4) GENERATED ALWAYS AS ((qty * cost_per_unit)) STORED,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT wip_ingredients_pkey PRIMARY KEY (id),
    CONSTRAINT wip_ingredients_wip_id_product_id_key UNIQUE (wip_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wip_ingredients_product
    ON public.wip_ingredients(product_id);
CREATE INDEX IF NOT EXISTS idx_wip_ingredients_wip
    ON public.wip_ingredients(wip_id);

ALTER TABLE IF EXISTS public.wip_ingredients
    ADD CONSTRAINT wip_ingredients_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.wip_ingredients
    ADD CONSTRAINT wip_ingredients_wip_id_fkey FOREIGN KEY (wip_id)
    REFERENCES public.wip_items (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.wip_position_access
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    wip_id uuid NOT NULL,
    position_id uuid NOT NULL,
    CONSTRAINT wip_position_access_pkey PRIMARY KEY (id),
    CONSTRAINT wip_position_access_wip_id_position_id_key UNIQUE (wip_id, position_id)
);

CREATE INDEX IF NOT EXISTS idx_wip_pos_access_position
    ON public.wip_position_access(position_id);
CREATE INDEX IF NOT EXISTS idx_wip_pos_access_wip
    ON public.wip_position_access(wip_id);

ALTER TABLE IF EXISTS public.wip_position_access
    ADD CONSTRAINT wip_position_access_position_id_fkey FOREIGN KEY (position_id)
    REFERENCES public.positions (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.wip_position_access
    ADD CONSTRAINT wip_position_access_wip_id_fkey FOREIGN KEY (wip_id)
    REFERENCES public.wip_items (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


END;