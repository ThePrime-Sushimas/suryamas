-- ============================================
-- Module: stock
-- Generated: 2026-06-09T16:36:06.344Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.stock_balances
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    warehouse_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty numeric(20, 4) NOT NULL DEFAULT 0,
    avg_cost numeric(20, 4) NOT NULL DEFAULT 0,
    last_movement_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT stock_balances_pkey PRIMARY KEY (id),
    CONSTRAINT stock_balances_warehouse_id_product_id_key UNIQUE (warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_product
    ON public.stock_balances(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_warehouse
    ON public.stock_balances(warehouse_id);

ALTER TABLE IF EXISTS public.stock_balances
    ADD CONSTRAINT stock_balances_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.stock_balances
    ADD CONSTRAINT stock_balances_warehouse_id_fkey FOREIGN KEY (warehouse_id)
    REFERENCES public.warehouses (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.stock_movements
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    warehouse_id uuid NOT NULL,
    product_id uuid NOT NULL,
    movement_type character varying(20) COLLATE pg_catalog."default" NOT NULL,
    qty numeric(20, 4) NOT NULL,
    cost_per_unit numeric(20, 4) NOT NULL DEFAULT 0,
    total_cost numeric(20, 4) NOT NULL DEFAULT 0,
    balance_after numeric(20, 4) NOT NULL DEFAULT 0,
    reference_type character varying(30) COLLATE pg_catalog."default",
    reference_id uuid,
    notes text COLLATE pg_catalog."default",
    movement_date date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT stock_movements_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product
    ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse
    ON public.stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_created
    ON public.stock_movements(warehouse_id, created_at DESC);

ALTER TABLE IF EXISTS public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.stock_movements
    ADD CONSTRAINT stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id)
    REFERENCES public.warehouses (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;