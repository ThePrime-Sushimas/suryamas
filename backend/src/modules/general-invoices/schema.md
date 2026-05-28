-- Table: public.general_invoice_templates

-- DROP TABLE IF EXISTS public.general_invoice_templates;

CREATE TABLE IF NOT EXISTS public.general_invoice_templates
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    template_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    vendor_id uuid NOT NULL,
    expense_type character varying(50) COLLATE pg_catalog."default" NOT NULL,
    is_confidential boolean NOT NULL DEFAULT false,
    recurrence character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'MONTHLY'::character varying,
    default_amount numeric(20,4),
    due_date_offset_days integer NOT NULL DEFAULT 14,
    notes text COLLATE pg_catalog."default",
    is_active boolean NOT NULL DEFAULT true,
    last_generated_at date,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT gen_inv_templates_pkey PRIMARY KEY (id),
    CONSTRAINT gen_inv_templates_branch_fkey FOREIGN KEY (branch_id)
        REFERENCES public.branches (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT gen_inv_templates_company_fkey FOREIGN KEY (company_id)
        REFERENCES public.companies (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT gen_inv_templates_created_by_fkey FOREIGN KEY (created_by)
        REFERENCES public.auth_users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT gen_inv_templates_vendor_fkey FOREIGN KEY (vendor_id)
        REFERENCES public.vendors (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT gen_inv_templates_expense_type_check CHECK (expense_type::text = ANY (ARRAY['UTILITY'::text, 'RENT'::text, 'SALARY_SUPPORT'::text, 'SUBSCRIPTION'::text, 'MAINTENANCE'::text, 'OTHER'::text])),
    CONSTRAINT gen_inv_templates_recurrence_check CHECK (recurrence::text = ANY (ARRAY['MONTHLY'::text, 'QUARTERLY'::text, 'YEARLY'::text]))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.general_invoice_templates
    OWNER to suryamas;
-- Index: idx_gen_tmpl_company

-- DROP INDEX IF EXISTS public.idx_gen_tmpl_company;

CREATE INDEX IF NOT EXISTS idx_gen_tmpl_company
    ON public.general_invoice_templates USING btree
    (company_id ASC NULLS LAST)
    TABLESPACE pg_default
    WHERE is_deleted = false;

-- Trigger: general_invoice_templates_updated_at

-- DROP TRIGGER IF EXISTS general_invoice_templates_updated_at ON public.general_invoice_templates;

CREATE OR REPLACE TRIGGER general_invoice_templates_updated_at
    BEFORE UPDATE 
    ON public.general_invoice_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();



