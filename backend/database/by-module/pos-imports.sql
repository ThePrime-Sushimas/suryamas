-- ============================================
-- Module: pos-imports
-- Generated: 2026-06-09T16:36:06.354Z
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.pos_imports
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    import_date date NOT NULL DEFAULT CURRENT_DATE,
    date_range_start date NOT NULL,
    date_range_end date NOT NULL,
    file_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    total_rows integer NOT NULL DEFAULT 0,
    new_rows integer NOT NULL DEFAULT 0,
    duplicate_rows integer NOT NULL DEFAULT 0,
    status pos_import_status_enum NOT NULL DEFAULT 'PENDING'::pos_import_status_enum,
    error_message text COLLATE pg_catalog."default",
    journal_id uuid,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    deleted_at timestamp without time zone,
    deleted_by uuid,
    is_deleted boolean NOT NULL DEFAULT false,
    chunk_info jsonb,
    processed_rows integer DEFAULT 0,
    CONSTRAINT pos_imports_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_pos_imports_branch
    ON public.pos_imports(branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_imports_company
    ON public.pos_imports(company_id);

ALTER TABLE IF EXISTS public.pos_imports
    ADD CONSTRAINT pos_imports_branch_id_fkey FOREIGN KEY (branch_id)
    REFERENCES public.branches (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pos_imports
    ADD CONSTRAINT pos_imports_company_id_fkey FOREIGN KEY (company_id)
    REFERENCES public.companies (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pos_imports
    ADD CONSTRAINT pos_imports_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pos_imports
    ADD CONSTRAINT pos_imports_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;
ALTER TABLE IF EXISTS public.pos_imports
    ADD CONSTRAINT pos_imports_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.auth_users (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE TABLE IF NOT EXISTS public.pos_import_lines
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    pos_import_id uuid NOT NULL,
    row_number integer NOT NULL,
    sales_number character varying(100) COLLATE pg_catalog."default",
    bill_number character varying(100) COLLATE pg_catalog."default",
    sales_type character varying(50) COLLATE pg_catalog."default",
    batch_order character varying(100) COLLATE pg_catalog."default",
    table_section character varying(100) COLLATE pg_catalog."default",
    table_name character varying(100) COLLATE pg_catalog."default",
    sales_date date,
    sales_date_in timestamp without time zone,
    sales_date_out timestamp without time zone,
    branch character varying(100) COLLATE pg_catalog."default",
    brand character varying(100) COLLATE pg_catalog."default",
    city character varying(100) COLLATE pg_catalog."default",
    area character varying(100) COLLATE pg_catalog."default",
    visit_purpose character varying(100) COLLATE pg_catalog."default",
    regular_member_code character varying(100) COLLATE pg_catalog."default",
    regular_member_name character varying(255) COLLATE pg_catalog."default",
    loyalty_member_code character varying(100) COLLATE pg_catalog."default",
    loyalty_member_name character varying(255) COLLATE pg_catalog."default",
    loyalty_member_type character varying(100) COLLATE pg_catalog."default",
    employee_code character varying(100) COLLATE pg_catalog."default",
    employee_name character varying(255) COLLATE pg_catalog."default",
    external_employee_code character varying(100) COLLATE pg_catalog."default",
    external_employee_name character varying(255) COLLATE pg_catalog."default",
    customer_name character varying(255) COLLATE pg_catalog."default",
    payment_method character varying(100) COLLATE pg_catalog."default",
    menu_category character varying(100) COLLATE pg_catalog."default",
    menu_category_detail character varying(100) COLLATE pg_catalog."default",
    menu character varying(255) COLLATE pg_catalog."default",
    custom_menu_name character varying(255) COLLATE pg_catalog."default",
    menu_code character varying(100) COLLATE pg_catalog."default",
    menu_notes text COLLATE pg_catalog."default",
    order_mode character varying(50) COLLATE pg_catalog."default",
    qty numeric(10, 2),
    price numeric(15, 2),
    subtotal numeric(15, 2),
    discount numeric(15, 2),
    service_charge numeric(15, 2),
    tax numeric(15, 2),
    vat numeric(15, 2),
    total numeric(15, 2),
    nett_sales numeric(15, 2),
    dpp numeric(15, 2),
    bill_discount numeric(15, 2),
    total_after_bill_discount numeric(15, 2),
    waiter character varying(255) COLLATE pg_catalog."default",
    order_time timestamp without time zone,
    journal_id uuid,
    mapped_at timestamp without time zone,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT pos_import_lines_pkey PRIMARY KEY (id),
    CONSTRAINT uq_pos_import_lines_row UNIQUE (pos_import_id, row_number)
);

CREATE INDEX IF NOT EXISTS idx_pos_import_lines_import
    ON public.pos_import_lines(pos_import_id);

ALTER TABLE IF EXISTS public.pos_import_lines
    ADD CONSTRAINT pos_import_lines_pos_import_id_fkey FOREIGN KEY (pos_import_id)
    REFERENCES public.pos_imports (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


END;