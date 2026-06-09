-- ============================================
-- Module: suppliers
-- Generated: 2026-06-09T16:36:06.343Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.suppliers
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    supplier_code character varying(50) COLLATE pg_catalog."default" NOT NULL,
    supplier_name character varying(200) COLLATE pg_catalog."default" NOT NULL,
    supplier_type supplier_type_enum NOT NULL,
    contact_person character varying(100) COLLATE pg_catalog."default" NOT NULL,
    phone character varying(20) COLLATE pg_catalog."default" NOT NULL,
    email character varying(100) COLLATE pg_catalog."default",
    address text COLLATE pg_catalog."default" NOT NULL,
    city character varying(100) COLLATE pg_catalog."default" NOT NULL,
    province character varying(100) COLLATE pg_catalog."default" NOT NULL,
    postal_code character varying(10) COLLATE pg_catalog."default",
    tax_id character varying(50) COLLATE pg_catalog."default",
    business_license character varying(100) COLLATE pg_catalog."default",
    payment_term_id integer,
    lead_time_days integer NOT NULL DEFAULT 1,
    minimum_order numeric(15, 2) NOT NULL DEFAULT 0,
    rating integer,
    is_active boolean NOT NULL DEFAULT true,
    notes text COLLATE pg_catalog."default",
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    created_by uuid,
    updated_by uuid,
    requires_invoice boolean NOT NULL DEFAULT true,
    default_tax_rate numeric(5, 2) NOT NULL DEFAULT 11,
    invoice_bypass_reason character varying(50) COLLATE pg_catalog."default",
    CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);

COMMENT ON COLUMN public.suppliers.requires_invoice
    IS 'When false, GR confirm skips auto PI draft';
COMMENT ON COLUMN public.suppliers.default_tax_rate
    IS 'Default PPN % for PI lines created from GR';
COMMENT ON COLUMN public.suppliers.invoice_bypass_reason
    IS 'marketplace | cash | informal — only when requires_invoice is false';

ALTER TABLE IF EXISTS public.suppliers
    ADD CONSTRAINT suppliers_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.employees (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.suppliers
    ADD CONSTRAINT suppliers_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.employees (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.supplier_products
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    supplier_id uuid NOT NULL,
    product_id uuid NOT NULL,
    price numeric(15, 2) NOT NULL,
    currency character varying(3) COLLATE pg_catalog."default" NOT NULL DEFAULT 'IDR'::character varying,
    lead_time_days integer,
    min_order_qty numeric(15, 2),
    is_preferred boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT supplier_products_pkey PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public.supplier_products
    ADD CONSTRAINT fk_created_by FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.supplier_products
    ADD CONSTRAINT fk_product FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.supplier_products
    ADD CONSTRAINT fk_supplier FOREIGN KEY (supplier_id)
    REFERENCES public.suppliers (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.supplier_products
    ADD CONSTRAINT fk_updated_by FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


END;